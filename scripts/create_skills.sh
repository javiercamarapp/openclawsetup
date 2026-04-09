#!/usr/bin/env bash
#
# create_skills.sh — generate the 50 OpenClaw skill files from config/skills.json
#
# Reads: config/skills.json (source of truth for all 50 skills)
# Writes: $SKILLS_DIR/*.md (one file per skill, YAML frontmatter + body)
#
# Environment variables:
#   SKILLS_DIR    Destination directory. Default: ~/.openclaw/workspace/skills
#   SKILLS_JSON   Source JSON.           Default: <repo-root>/config/skills.json
#   FORCE         If "1", overwrite existing files. Default: 0 (skip existing)
#
# Usage:
#   bash scripts/create_skills.sh
#   FORCE=1 bash scripts/create_skills.sh          # overwrite
#   SKILLS_DIR=/tmp/test bash scripts/create_skills.sh   # dry target
#
# Requirements: Node.js 18+ (uses fs/promises, path, os, url).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_JSON="${SKILLS_JSON:-$REPO_ROOT/config/skills.json}"
SKILLS_DIR="${SKILLS_DIR:-$HOME/.openclaw/workspace/skills}"
FORCE="${FORCE:-0}"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node not found on PATH. Install Node.js 18+ first." >&2
  exit 1
fi

if [[ ! -f "$SKILLS_JSON" ]]; then
  echo "❌ SKILLS_JSON not found: $SKILLS_JSON" >&2
  exit 1
fi

mkdir -p "$SKILLS_DIR"

SKILLS_JSON="$SKILLS_JSON" SKILLS_DIR="$SKILLS_DIR" FORCE="$FORCE" node - <<'NODE_EOF'
const fs = require('fs');
const path = require('path');

const jsonPath  = process.env.SKILLS_JSON;
const outDir    = process.env.SKILLS_DIR;
const force     = process.env.FORCE === '1';

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
const skills = Array.isArray(data.skills) ? data.skills : [];

if (skills.length !== 50) {
  console.warn(`⚠️  Expected 50 skills, got ${skills.length}. Continuing anyway.`);
}

// Escape a string for YAML double-quoted scalar.
function yamlStr(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

let created = 0;
let skipped = 0;
let failed  = 0;

for (const s of skills) {
  if (!s.code) { failed++; continue; }
  const fname = path.join(outDir, s.code.toLowerCase() + '.md');

  if (fs.existsSync(fname) && !force) {
    console.log(`⏭   ${s.code.padEnd(14)}  (skipped, exists) ${fname}`);
    skipped++;
    continue;
  }

  const triggers = Array.isArray(s.triggers) ? s.triggers : [];
  const triggersYaml = '[' + triggers.map(t => `"${yamlStr(t)}"`).join(', ') + ']';

  // escalation_model is optional in OpenClaw's skill frontmatter. We include it if present.
  const lines = [
    '---',
    `name: ${s.code}`,
    `description: "${yamlStr(s.description || '')}"`,
    `model: "${yamlStr(s.model || '')}"`,
    `fallbackModel: "${yamlStr(s.fallback_model || '')}"`,
  ];
  if (s.escalation_model) {
    lines.push(`escalationModel: "${yamlStr(s.escalation_model)}"`);
  }
  lines.push(
    `triggers: ${triggersYaml}`,
    `temperature: ${s.temperature ?? 0.5}`,
    `maxTokens: ${s.max_tokens ?? 4096}`,
    `division: ${s.division ?? 0}`,
    `divisionName: "${yamlStr(s.division_name || '')}"`,
    `tier: "${yamlStr(s.tier || '')}"`,
    '---',
    s.system_prompt || '',
    '',
  );

  fs.writeFileSync(fname, lines.join('\n'), 'utf-8');
  console.log(`✅  ${s.code.padEnd(14)}  ${s.tier.padEnd(7)}  ${s.model}`);
  created++;
}

const total = fs.readdirSync(outDir).filter(f => f.endsWith('.md')).length;
console.log('');
console.log(`🦞 Summary: ${created} created, ${skipped} skipped, ${failed} failed`);
console.log(`   Directory: ${outDir}`);
console.log(`   Total .md files now: ${total}`);

if (total < 50) {
  console.error(`\n❌ Expected 50 skill files, found ${total}. Investigate missing codes above.`);
  process.exit(1);
}

// Quick sanity check on the division distribution
const bins = {};
for (const f of fs.readdirSync(outDir).filter(f => f.endsWith('.md'))) {
  const txt = fs.readFileSync(path.join(outDir, f), 'utf-8');
  const m = txt.match(/^division:\s*(\d+)/m);
  if (m) bins[m[1]] = (bins[m[1]] || 0) + 1;
}
console.log('\n📊 Division distribution:');
const expected = { '1': 8, '2': 10, '3': 5, '4': 7, '5': 8, '6': 4, '7': 5, '8': 3 };
for (const [div, want] of Object.entries(expected)) {
  const got = bins[div] || 0;
  const ok = got === want ? '✅' : '⚠️ ';
  console.log(`   ${ok} Div ${div}: ${got} (expected ${want})`);
}
NODE_EOF

echo ""
echo "Next steps:"
echo "  1. Verify: ls $SKILLS_DIR/*.md | wc -l   # should print 50"
echo "  2. Test one skill: openclaw test --skill forge \"escribe hello world en python\""
echo "  3. Restart the gateway: openclaw gateway restart"
