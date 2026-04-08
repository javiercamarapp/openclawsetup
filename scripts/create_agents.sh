#!/usr/bin/env bash
#
# create_agents.sh — provision the 8 OpenClaw isolated agents for Javier's
# command center, based on config/personas-to-agents.json + config/skills.json.
#
# For each of the 8 agents:
#   1. openclaw agents add <name> --model <verified_id> --workspace ... --agent-dir ... --non-interactive
#   2. Delete the default workspace .md boilerplate (AGENTS.md, SOUL.md, IDENTITY.md, USER.md,
#      BOOTSTRAP.md, HEARTBEAT.md, TOOLS.md) — proven from PILOT testing that Qwen-tier models
#      get hijacked by default boilerplate and respond with meta-commentary. Empty workspace
#      lets the --message user prompt take full control.
#   3. Copy ~/.openclaw/agents/main/agent/models.json into the new agent's agent-dir
#      (OpenClaw's openclaw agents add does NOT populate this file automatically; without it
#      the agent silently falls back to canned responses). Write agent.json and config.json
#      with the agent's fixed model ID.
#
# After all 8 agents exist, prints a summary and a verification command for each.
#
# Requirements:
#   - OpenClaw 2026.4.5 gateway running (openclaw gateway status)
#   - ~/.openclaw/agents/main/agent/models.json with a valid OpenRouter API key
#   - Python 3 (for JSON parsing, pre-installed on macOS)
#   - jq is NOT required — we use Python
#
# Usage:
#   bash scripts/create_agents.sh
#
# Env vars:
#   FORCE=1  — if set, delete pre-existing agents with the same names before recreating
#              (destructive — wipes their workspaces and sessions too)
#   DRY_RUN=1 — print what would happen without actually running openclaw commands

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MAPPING_JSON="$REPO_ROOT/config/personas-to-agents.json"
SKILLS_JSON="$REPO_ROOT/config/skills.json"

FORCE="${FORCE:-0}"
DRY_RUN="${DRY_RUN:-0}"

# Preflight
if ! command -v openclaw >/dev/null 2>&1; then
  echo "❌ openclaw not on PATH. Install OpenClaw 2026.4.5 first."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ python3 not on PATH."
  exit 1
fi

if [[ ! -f "$MAPPING_JSON" ]]; then
  echo "❌ Mapping file not found: $MAPPING_JSON"
  exit 1
fi

MAIN_MODELS_JSON="$HOME/.openclaw/agents/main/agent/models.json"
if [[ ! -f "$MAIN_MODELS_JSON" ]]; then
  echo "❌ Main agent models.json not found: $MAIN_MODELS_JSON"
  echo "   Run 'openclaw setup' or 'openclaw onboard' to initialize the main agent first."
  exit 1
fi

echo "🦞 OpenClaw 8-agent provisioner"
echo "   Mapping: $MAPPING_JSON"
echo "   Source of models.json (copied to each agent): $MAIN_MODELS_JSON"
[[ "$FORCE" == "1" ]] && echo "   FORCE=1 → will delete existing agents before recreating"
[[ "$DRY_RUN" == "1" ]] && echo "   DRY_RUN=1 → no mutations"
echo

# Read agent names + models from the mapping file
AGENT_NAMES=($(python3 -c "
import json
with open('$MAPPING_JSON') as f:
    d = json.load(f)
for name in d['agents']:
    print(name)
"))

TOTAL="${#AGENT_NAMES[@]}"
echo "Found $TOTAL agents to provision: ${AGENT_NAMES[*]}"
echo

CREATED=0
SKIPPED=0
FAILED=0

for AGENT in "${AGENT_NAMES[@]}"; do
  # Read model from mapping
  MODEL=$(python3 -c "
import json
with open('$MAPPING_JSON') as f:
    d = json.load(f)
print(d['agents']['$AGENT']['model'])
")

  WORKSPACE="$HOME/.openclaw/agents/$AGENT/workspace"
  AGENT_DIR="$HOME/.openclaw/agents/$AGENT/agent"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🤖 $AGENT"
  echo "   Model:     $MODEL"
  echo "   Workspace: $WORKSPACE"
  echo "   Agent dir: $AGENT_DIR"

  # Check if agent already exists (via openclaw agents list)
  EXISTS=0
  if openclaw agents list 2>/dev/null | grep -q "^- $AGENT$"; then
    EXISTS=1
  fi

  if [[ "$EXISTS" == "1" ]]; then
    if [[ "$FORCE" == "1" ]]; then
      echo "   ⚠️  Agent exists. FORCE=1 → deleting first."
      if [[ "$DRY_RUN" == "0" ]]; then
        openclaw agents delete "$AGENT" --yes 2>&1 || openclaw agents delete "$AGENT" 2>&1 || true
      fi
    else
      echo "   ⏭  Agent already exists. Skipping (use FORCE=1 to recreate)."
      SKIPPED=$((SKIPPED+1))
      continue
    fi
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "   [dry-run] openclaw agents add $AGENT --model \"$MODEL\" --workspace $WORKSPACE --agent-dir $AGENT_DIR --non-interactive"
    echo "   [dry-run] wipe workspace .md files, populate agent-dir JSONs"
    CREATED=$((CREATED+1))
    continue
  fi

  # 1. Create the agent
  if ! openclaw agents add "$AGENT" \
      --model "$MODEL" \
      --workspace "$WORKSPACE" \
      --agent-dir "$AGENT_DIR" \
      --non-interactive 2>&1 | sed 's/^/     /'; then
    echo "   ❌ openclaw agents add failed"
    FAILED=$((FAILED+1))
    continue
  fi

  # 2. Wipe workspace .md files (PILOT showed these hijack small models)
  if [[ -d "$WORKSPACE" ]]; then
    python3 -c "
from pathlib import Path
ws = Path('$WORKSPACE')
count = 0
for md in ws.glob('*.md'):
    md.unlink()
    count += 1
print(f'     🗑  Wiped {count} .md files from workspace')
"
  fi

  # 3. Populate agent-dir with models.json (copied from main) + agent.json + config.json
  mkdir -p "$AGENT_DIR"
  cp "$MAIN_MODELS_JSON" "$AGENT_DIR/models.json"
  echo "{\"model\": \"$MODEL\"}" > "$AGENT_DIR/agent.json"
  echo "{\"model\": \"$MODEL\"}" > "$AGENT_DIR/config.json"
  echo "     ✅ agent-dir populated (models.json copied + agent.json/config.json written)"

  CREATED=$((CREATED+1))
done

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🦞 Summary: $CREATED created, $SKIPPED skipped, $FAILED failed (of $TOTAL)"
echo

if [[ "$DRY_RUN" == "1" ]]; then
  echo "Dry run — no mutations. Remove DRY_RUN=1 to actually create."
  exit 0
fi

if [[ "$FAILED" -gt 0 ]]; then
  echo "⚠️  Some agents failed. Review errors above and retry."
  exit 1
fi

# Restart gateway so all new agents are loaded
echo "Restarting gateway to load new agents..."
openclaw gateway restart 2>&1 | sed 's/^/  /'
sleep 2

# Verify all 8 agents appear in the list
echo
echo "Verification: openclaw agents list"
openclaw agents list 2>&1 | sed 's/^/  /'

echo
echo "Quick smoke test for each new agent (prompt: 'Responde solo: ok'):"
for AGENT in "${AGENT_NAMES[@]}"; do
  printf "  %-14s " "$AGENT"
  RESPONSE=$(openclaw agent --agent "$AGENT" --session-id "smoke-$(date +%s)-$AGENT" --message "Responde solo la palabra: ok" 2>&1 | tail -5 | tr -d '\n' | cut -c 1-100)
  echo "→ $RESPONSE"
done

echo
echo "✅ Done. Next: provision cron jobs via scripts/create_crons.sh (not yet written)."
