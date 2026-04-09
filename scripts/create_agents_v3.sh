#!/usr/bin/env bash
#
# create_agents_v3.sh — provision the v3 25-agent topology for Javier's
# OpenClaw command center, driven from config/personas-to-agents.json.
#
# v3 replaces create_agents.sh. Key differences:
#   - 25 agents instead of 8 (see _meta in the JSON).
#   - Does NOT call `openclaw agents add`. In v3 testing we confirmed the
#     OpenClaw 2026.4.5 CLI fights us on per-agent model pinning; manual
#     filesystem provisioning is more reliable. Gateway picks up new agents
#     via directory scan on restart.
#   - Data-driven: adding an agent means editing the JSON, re-running this
#     script. No bash arrays to maintain in parallel.
#   - Built-in PRUNE phase: deletes obsolete agents that are no longer in
#     the JSON (e.g. the v2→v3 rename of grok → grok-sales, qwen-free split
#     into qwen-general + qwen-finance, local-vision → gemma-vision).
#   - Skips agents whose JSON entry has `_note` containing "RESERVED" —
#     those are placeholders for future rate-limit fallback, not agents
#     to provision now (currently: hermes-405b-paid).
#
# For each provisioned agent:
#   1. Create the agent dir tree (~/.openclaw/agents/<name>/{agent,workspace,sessions}).
#   2. Copy ~/.openclaw/agents/main/agent/models.json AND auth-profiles.json
#      into the new agent's agent-dir. Both are required — auth-profiles.json
#      carries the OpenRouter API key; without it the agent silently falls
#      back to canned responses (same symptom reproduced in the Bloque 2 PILOT).
#   3. Write agent.json with {"id", "model"} and config.json with {}.
#
# After provisioning, kickstart the gateway and run a smoke test against 5
# representative agents (configurable).
#
# Requirements:
#   - OpenClaw 2026.4.5 gateway installed (`openclaw` on PATH).
#   - ~/.openclaw/agents/main/agent/{models.json, auth-profiles.json} — the
#     source of truth for model registry and OpenRouter credentials.
#   - macOS launchctl (`launchctl kickstart gui/$UID/ai.openclaw.gateway`).
#     If you're on Linux, swap to `openclaw gateway restart`.
#   - Python 3 for JSON parsing (pre-installed on macOS).
#
# Usage:
#   bash scripts/create_agents_v3.sh                  # idempotent: create missing, skip existing
#   PRUNE=1 bash scripts/create_agents_v3.sh          # also delete obsolete agents not in JSON
#   FORCE=1 bash scripts/create_agents_v3.sh          # delete + recreate every agent in JSON
#   PRUNE=1 FORCE=1 bash scripts/create_agents_v3.sh  # nuclear: wipe obsolete + force recreate all
#   DRY_RUN=1 bash scripts/create_agents_v3.sh        # print actions without mutating
#
# Exit codes:
#   0 — all agents provisioned, gateway restarted, smoke tests passed
#   1 — preflight failure (missing binary, missing main auth file, etc.)
#   2 — one or more agents failed to provision
#   3 — smoke test failure after provisioning

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MAPPING_JSON="$REPO_ROOT/config/personas-to-agents.json"

AGENTS_DIR="$HOME/.openclaw/agents"
MAIN_MODELS_JSON="$AGENTS_DIR/main/agent/models.json"
MAIN_AUTH_PROFILES="$AGENTS_DIR/main/agent/auth-profiles.json"

PRUNE="${PRUNE:-0}"
FORCE="${FORCE:-0}"
DRY_RUN="${DRY_RUN:-0}"

# Agents to skip-pretending-they-don't-exist during PRUNE (built-in OpenClaw agents).
PROTECTED_AGENTS=("main")

# Representative subset for the smoke test phase (one per tier family).
SMOKE_TEST_AGENTS=("premium" "grok-sales" "qwen-general" "minimax-code" "stepfun")

# ──────────────────────────────────────────────────────────────────────────────
# Preflight
# ──────────────────────────────────────────────────────────────────────────────

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

if ! python3 -m json.tool "$MAPPING_JSON" >/dev/null 2>&1; then
  echo "❌ $MAPPING_JSON is not valid JSON"
  exit 1
fi

if [[ ! -f "$MAIN_MODELS_JSON" ]]; then
  echo "❌ Main agent models.json not found: $MAIN_MODELS_JSON"
  echo "   Run 'openclaw onboard' first to initialize the main agent."
  exit 1
fi

if [[ ! -f "$MAIN_AUTH_PROFILES" ]]; then
  echo "❌ Main agent auth-profiles.json not found: $MAIN_AUTH_PROFILES"
  echo "   This file carries the OpenRouter API key. Run 'openclaw onboard'"
  echo "   and re-enter your provider credentials to regenerate it."
  exit 1
fi

echo "🦞 OpenClaw v3 provisioner (25-agent topology)"
echo "   Mapping:          $MAPPING_JSON"
echo "   Main models.json: $MAIN_MODELS_JSON"
echo "   Main auth:        $MAIN_AUTH_PROFILES"
echo "   Target dir:       $AGENTS_DIR"
[[ "$PRUNE" == "1" ]]   && echo "   PRUNE=1   → delete agents not in JSON"
[[ "$FORCE" == "1" ]]   && echo "   FORCE=1   → delete + recreate every agent in JSON"
[[ "$DRY_RUN" == "1" ]] && echo "   DRY_RUN=1 → no filesystem mutations, no gateway restart"
echo

# ──────────────────────────────────────────────────────────────────────────────
# Read mapping: list of (name, model) for agents to provision, plus reserved set
# ──────────────────────────────────────────────────────────────────────────────

# Emit tab-separated lines: "NAME<TAB>MODEL" for agents to provision (skipping RESERVED).
AGENT_TSV=$(python3 - "$MAPPING_JSON" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
for name, spec in d["agents"].items():
    if isinstance(spec, dict) and "RESERVED" in str(spec.get("_note", "")):
        continue
    print(f"{name}\t{spec['model']}")
PY
)

# Also emit names of reserved agents (for reporting).
RESERVED_NAMES=$(python3 - "$MAPPING_JSON" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
for name, spec in d["agents"].items():
    if isinstance(spec, dict) and "RESERVED" in str(spec.get("_note", "")):
        print(name)
PY
)

# All names in the JSON (provisioned + reserved), used by the PRUNE phase to
# determine what's obsolete.
ALL_JSON_NAMES=$(python3 - "$MAPPING_JSON" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
for name in d["agents"]:
    print(name)
PY
)

PROVISION_COUNT=$(printf '%s\n' "$AGENT_TSV" | grep -c . || true)
RESERVED_COUNT=$(printf '%s\n' "$RESERVED_NAMES" | grep -c . || true)

echo "Plan: $PROVISION_COUNT agents to provision, $RESERVED_COUNT reserved (skipped)"
if [[ "$RESERVED_COUNT" -gt 0 ]]; then
  echo "   reserved: $(printf '%s ' $RESERVED_NAMES)"
fi
echo

# ──────────────────────────────────────────────────────────────────────────────
# PRUNE phase (optional): delete agents on disk that aren't in the JSON
# ──────────────────────────────────────────────────────────────────────────────

if [[ "$PRUNE" == "1" ]]; then
  echo "━━━ PRUNE phase ━━━"
  if [[ ! -d "$AGENTS_DIR" ]]; then
    echo "   (no $AGENTS_DIR — nothing to prune)"
  else
    # Build the allowlist: everything in the JSON + PROTECTED_AGENTS.
    # Tab-separated values, then grep-match on exact line.
    ALLOWLIST=$(printf '%s\n' "$ALL_JSON_NAMES" "${PROTECTED_AGENTS[@]}")
    PRUNED=0
    for path in "$AGENTS_DIR"/*/; do
      [[ -d "$path" ]] || continue
      name=$(basename "$path")
      if printf '%s\n' "$ALLOWLIST" | grep -qx "$name"; then
        continue  # in the JSON or protected
      fi
      echo "   🗑  obsolete: $name"
      if [[ "$DRY_RUN" == "0" ]]; then
        # Try the CLI first (cleans up any gateway-side state), fall back to rm -rf.
        openclaw agents delete "$name" --force 2>/dev/null || rm -rf "$path"
      fi
      PRUNED=$((PRUNED + 1))
    done
    echo "   → $PRUNED obsolete agent(s) removed"
  fi
  echo
fi

# ──────────────────────────────────────────────────────────────────────────────
# PROVISION phase
# ──────────────────────────────────────────────────────────────────────────────

CREATED=0
UPDATED=0
SKIPPED=0
FAILED=0

while IFS=$'\t' read -r AGENT MODEL; do
  [[ -z "$AGENT" ]] && continue

  AGENT_DIR_BASE="$AGENTS_DIR/$AGENT"
  AGENT_DIR="$AGENT_DIR_BASE/agent"
  WORKSPACE="$AGENT_DIR_BASE/workspace"
  SESSIONS="$AGENT_DIR_BASE/sessions"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🤖 $AGENT"
  echo "   Model: $MODEL"
  echo "   Path:  $AGENT_DIR_BASE"

  EXISTS=0
  if [[ -d "$AGENT_DIR_BASE" ]]; then
    EXISTS=1
  fi

  if [[ "$EXISTS" == "1" && "$FORCE" == "0" ]]; then
    echo "   ⏭  exists, skipping (FORCE=1 to recreate)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  if [[ "$EXISTS" == "1" && "$FORCE" == "1" ]]; then
    echo "   ⚠️  exists + FORCE=1 → deleting first"
    if [[ "$DRY_RUN" == "0" ]]; then
      openclaw agents delete "$AGENT" --force 2>/dev/null || rm -rf "$AGENT_DIR_BASE"
    fi
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "   [dry-run] mkdir + cp models.json + cp auth-profiles.json + write agent.json/config.json"
    if [[ "$EXISTS" == "1" ]]; then UPDATED=$((UPDATED + 1)); else CREATED=$((CREATED + 1)); fi
    continue
  fi

  # 1. Create the dir tree
  mkdir -p "$AGENT_DIR" "$WORKSPACE" "$SESSIONS"

  # 2. Copy the main agent's models.json and auth-profiles.json. Both are
  #    required — auth-profiles.json carries the OpenRouter API key and
  #    without it the agent silently returns canned fallback responses.
  if ! cp "$MAIN_MODELS_JSON" "$AGENT_DIR/models.json"; then
    echo "   ❌ failed to copy models.json"
    FAILED=$((FAILED + 1))
    continue
  fi
  if ! cp "$MAIN_AUTH_PROFILES" "$AGENT_DIR/auth-profiles.json"; then
    echo "   ❌ failed to copy auth-profiles.json"
    FAILED=$((FAILED + 1))
    continue
  fi

  # 3. Write agent.json and config.json
  cat > "$AGENT_DIR/agent.json" <<AJEOF
{
  "id": "$AGENT",
  "model": "$MODEL"
}
AJEOF
  echo "{}" > "$AGENT_DIR/config.json"

  echo "   ✅ provisioned"
  if [[ "$EXISTS" == "1" ]]; then UPDATED=$((UPDATED + 1)); else CREATED=$((CREATED + 1)); fi

done <<< "$AGENT_TSV"

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🦞 Provision summary:"
echo "   created: $CREATED"
echo "   updated: $UPDATED (existed + FORCE=1)"
echo "   skipped: $SKIPPED (existed, no FORCE)"
echo "   failed:  $FAILED"
echo

if [[ "$DRY_RUN" == "1" ]]; then
  echo "Dry run — no mutations. Remove DRY_RUN=1 to actually provision."
  exit 0
fi

if [[ "$FAILED" -gt 0 ]]; then
  echo "⚠️  Some agents failed. Review errors above and retry."
  exit 2
fi

# ──────────────────────────────────────────────────────────────────────────────
# Gateway restart
# ──────────────────────────────────────────────────────────────────────────────

echo "━━━ Restarting gateway ━━━"
if command -v launchctl >/dev/null 2>&1; then
  # macOS path: kickstart the launchd-managed gateway. gui/$UID gets Javier's
  # agent domain (typically gui/501 on his Mac Mini).
  launchctl kickstart -k "gui/$UID/ai.openclaw.gateway" 2>&1 | sed 's/^/  /' || {
    echo "  ⚠️  launchctl kickstart failed — falling back to 'openclaw gateway restart'"
    openclaw gateway restart 2>&1 | sed 's/^/  /'
  }
else
  openclaw gateway restart 2>&1 | sed 's/^/  /'
fi
sleep 3

echo
echo "openclaw agents list:"
openclaw agents list 2>&1 | sed 's/^/  /'
echo

# ──────────────────────────────────────────────────────────────────────────────
# Smoke test — 5 representative agents
# ──────────────────────────────────────────────────────────────────────────────

echo "━━━ Smoke test (${#SMOKE_TEST_AGENTS[@]} representative agents) ━━━"
SMOKE_FAILED=0
for AGENT in "${SMOKE_TEST_AGENTS[@]}"; do
  printf "  %-22s " "$AGENT"
  RESPONSE=$(openclaw agent --agent "$AGENT" \
      --session-id "smoke-$(date +%s)-$AGENT" \
      --message "Responde solo la palabra: ok" 2>&1 | tail -5 | tr '\n' ' ' | cut -c 1-120)
  if [[ -z "$RESPONSE" ]]; then
    echo "→ ❌ empty response"
    SMOKE_FAILED=$((SMOKE_FAILED + 1))
  else
    echo "→ $RESPONSE"
  fi
done

echo
if [[ "$SMOKE_FAILED" -gt 0 ]]; then
  echo "⚠️  $SMOKE_FAILED/${#SMOKE_TEST_AGENTS[@]} smoke tests failed. Check logs: openclaw logs --tail 50"
  exit 3
fi

echo "✅ Done. $PROVISION_COUNT agents provisioned, gateway up, smoke tests passed."
echo
echo "Next: run a broader smoke test for ALL $PROVISION_COUNT agents if you want full coverage:"
echo "  python3 -c 'import json; [print(n) for n in json.load(open(\"$MAPPING_JSON\"))[\"agents\"] if \"RESERVED\" not in str(json.load(open(\"$MAPPING_JSON\"))[\"agents\"][n].get(\"_note\",\"\"))]' | while read a; do"
echo "    printf \"%-22s \" \"\$a\"; openclaw agent --agent \"\$a\" --session-id \"smoke-\$(date +%s)-\$a\" --message \"di: ok\" 2>&1 | tail -1"
echo "  done"
