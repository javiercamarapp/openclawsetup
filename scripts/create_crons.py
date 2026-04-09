#!/usr/bin/env python3
"""
scripts/create_crons.py — provision the 13 Bloque 2 heartbeat cron jobs.

Reads:
  - config/heartbeats.json        (13 scheduled jobs with cron + prompt)
  - config/personas-to-agents.json (25-agent topology with per-agent models)

For each heartbeat in heartbeats.json, joins it to its agent+model and runs:

  openclaw cron add \
    --name <hb.id> \
    --session-key agent:<agent>:<hb.id> \
    --model openrouter/<agent.model> \
    --message <hb.prompt> \
    --cron <hb.schedule> \
    --no-deliver --light-context --tools read \
    --timeout-seconds 300 \
    --json

Key design decisions (learned the hard way in Bloque 2):

  - `openclaw agent --agent X` does NOT honor per-agent model pins in 2026.4.5;
    it always uses the global default (agents.defaults.model.primary). So
    interactive calls can't be model-specific. The only per-task model
    selector is `cron add --model`.

  - Model IDs need the `openrouter/` prefix so OpenClaw routes via OpenRouter
    (which has Javier's valid key) instead of direct Anthropic (which is
    billing-disabled). Ollama local models keep their `ollama/` prefix.

  - `--no-deliver` is REQUIRED to avoid the false-failed status from
    OpenClaw trying to deliver results to an unlinked WhatsApp channel.
    Without it, jobs succeed at the model call but get marked `failed` by
    the task framework.

  - `--light-context` dramatically reduces input tokens (13k → ~6k in
    testing) by skipping the workspace .md boilerplate injection that
    otherwise hijacks small models with meta-commentary.

  - `--tools read` gives a minimal tool allow-list so models don't try to
    hallucinate tool calls (exec, cron, browser) for trivial prompts.

Requirements:
  - Python 3 (stdlib only)
  - `openclaw` on PATH
  - OpenClaw gateway running
  - The 25 agents provisioned (run scripts/create_agents_v3.sh first)

Usage:
  python3 scripts/create_crons.py             # create all 13 heartbeats
  DRY_RUN=1 python3 scripts/create_crons.py   # preview, no mutations
  FORCE=1 python3 scripts/create_crons.py     # delete existing by name, recreate

Exit codes:
  0 — all heartbeats created (or dry-run finished)
  1 — preflight failure (missing files, missing binary)
  2 — one or more cron adds failed
"""

import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
HEARTBEATS_PATH = REPO_ROOT / "config" / "heartbeats.json"
AGENTS_PATH = REPO_ROOT / "config" / "personas-to-agents.json"

DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"
FORCE = os.environ.get("FORCE", "0") == "1"

# Per-heartbeat timeout in seconds (some of the reporting heartbeats
# legitimately take a minute or two, so give them breathing room).
TIMEOUT_SECONDS = "300"

# Default tool allow-list. Models only need `read` for these reporting
# heartbeats — they shouldn't be executing shell commands or editing files.
# If a specific heartbeat needs more tools in the future, add it to the
# TOOLS_OVERRIDES map below.
TOOLS_DEFAULT = "read"
TOOLS_OVERRIDES = {
    # Example: "benchmarker-eval": "read,web_search"
}


def load_json(path):
    with open(path) as f:
        return json.load(f)


def build_persona_to_agent_map(agents_data):
    """Build {PERSONA_CODE: (agent_name, model_id)} from personas-to-agents.json.

    Persona codes in the JSON are UPPERCASE (HUNTER, WATCHTOWER, etc.),
    matching the convention in skills.json.
    """
    mapping = {}
    for agent_name, spec in agents_data["agents"].items():
        if not isinstance(spec, dict):
            continue
        if "RESERVED" in str(spec.get("_note", "")):
            continue
        model = spec.get("model")
        if not model:
            continue
        for persona in spec.get("personas", []) or []:
            mapping[persona] = (agent_name, model)
    return mapping


def openrouter_model(model_id):
    """Prefix `openrouter/` unless the model is already openrouter/ or ollama/.

    OpenClaw routes by prefix: `openrouter/X` goes through OpenRouter,
    `ollama/X` goes through the local Ollama daemon, no-prefix is
    interpreted as direct provider which may hit auth/billing walls.
    """
    if model_id.startswith("ollama/") or model_id.startswith("openrouter/"):
        return model_id
    return f"openrouter/{model_id}"


def run_openclaw(args, capture=True):
    """Run `openclaw <args...>` and return (returncode, stdout, stderr).

    In DRY_RUN mode, print the command and return success without running.
    """
    cmd = ["openclaw"] + args
    if DRY_RUN:
        printable = " ".join(
            repr(a) if (" " in a or "\n" in a) else a for a in cmd
        )
        print(f"     [dry-run] {printable}")
        return (0, "", "")
    r = subprocess.run(cmd, capture_output=capture, text=True)
    return (r.returncode, r.stdout, r.stderr)


def existing_cron_by_name(name):
    """Look up an existing cron job by name. Returns its id, or None.

    Uses `openclaw cron list --json` (if supported) and greps by name.
    Best-effort — returns None on any failure (caller treats as not existing).
    """
    code, out, err = run_openclaw(["cron", "list", "--json"], capture=True)
    if code != 0:
        return None
    try:
        data = json.loads(out)
    except Exception:
        # Maybe --json is not supported and the output is plain text.
        # Fall back to parsing the plain text list for lines that contain
        # the name as a separate word (ID is typically first column).
        for line in out.splitlines():
            parts = line.split()
            if len(parts) >= 2 and parts[1] == name:
                return parts[0]
        return None
    jobs = data.get("jobs") or data.get("entries") or []
    for job in jobs:
        if job.get("name") == name:
            return job.get("id")
    return None


def delete_cron(job_id):
    code, out, err = run_openclaw(["cron", "rm", job_id])
    return code == 0


def create_cron(hb, agent_name, model_id):
    """Build and run the `openclaw cron add` command for one heartbeat."""
    hb_id = hb["id"]
    full_model = openrouter_model(model_id)
    tools = TOOLS_OVERRIDES.get(hb_id, TOOLS_DEFAULT)

    args = [
        "cron", "add",
        "--name", hb_id,
        "--session-key", f"agent:{agent_name}:{hb_id}",
        "--model", full_model,
        "--message", hb["prompt"],
        "--cron", hb["schedule"],
        "--no-deliver",
        "--light-context",
        "--tools", tools,
        "--timeout-seconds", TIMEOUT_SECONDS,
        "--json",
    ]

    if not hb.get("enabled", True):
        args.append("--disabled")

    code, out, err = run_openclaw(args, capture=True)
    return code, out, err


def main():
    # Preflight
    if not HEARTBEATS_PATH.exists():
        print(f"ERROR: {HEARTBEATS_PATH} not found", file=sys.stderr)
        return 1
    if not AGENTS_PATH.exists():
        print(f"ERROR: {AGENTS_PATH} not found", file=sys.stderr)
        return 1

    # In DRY_RUN we still want to show the commands; skip the binary check
    # so users on a dev machine without openclaw installed can preview.
    if not DRY_RUN:
        try:
            r = subprocess.run(
                ["openclaw", "--version"],
                capture_output=True, text=True, timeout=10,
            )
            if r.returncode != 0:
                print("ERROR: `openclaw --version` failed. Is the CLI installed?", file=sys.stderr)
                return 1
        except FileNotFoundError:
            print("ERROR: `openclaw` not on PATH. Install OpenClaw 2026.4.5 first.", file=sys.stderr)
            return 1
        except subprocess.TimeoutExpired:
            print("ERROR: `openclaw --version` timed out.", file=sys.stderr)
            return 1

    heartbeats_doc = load_json(HEARTBEATS_PATH)
    agents_doc = load_json(AGENTS_PATH)

    persona_to_agent = build_persona_to_agent_map(agents_doc)
    hb_list = heartbeats_doc.get("heartbeats", [])

    print("🦞 OpenClaw heartbeat cron provisioner (Bloque 2)")
    print(f"   Heartbeats: {HEARTBEATS_PATH}")
    print(f"   Agents:     {AGENTS_PATH}")
    print(f"   {len(hb_list)} heartbeats, {len(persona_to_agent)} personas mapped")
    if DRY_RUN:
        print("   DRY_RUN=1 — no mutations")
    if FORCE:
        print("   FORCE=1 — delete existing by name before recreating")
    print()

    created = 0
    skipped = 0
    failed = 0
    unmapped = []

    for hb in hb_list:
        hb_id = hb.get("id")
        skill = (hb.get("skill") or "").upper()
        schedule = hb.get("schedule")
        prompt = hb.get("prompt", "")
        enabled = hb.get("enabled", True)

        print(f"━━━ {hb_id} ━━━")
        print(f"   skill:    {skill}")
        print(f"   schedule: {schedule}")
        print(f"   enabled:  {enabled}")

        if skill not in persona_to_agent:
            print(f"   ❌ persona {skill!r} not found in personas-to-agents.json")
            unmapped.append((hb_id, skill))
            failed += 1
            print()
            continue

        agent_name, model_id = persona_to_agent[skill]
        full_model = openrouter_model(model_id)
        print(f"   agent:    {agent_name}")
        print(f"   model:    {full_model}")
        print(f"   prompt:   {prompt[:80]}{'...' if len(prompt) > 80 else ''}")

        # Handle existing job with same name
        if FORCE:
            old_id = existing_cron_by_name(hb_id)
            if old_id:
                print(f"   🗑  deleting existing {hb_id} ({old_id[:8]}...)")
                if not delete_cron(old_id):
                    print(f"   ⚠️  delete failed, will still try to add (may conflict)")

        code, out, err = create_cron(hb, agent_name, model_id)
        if code != 0:
            # If the error is "already exists", count it as skipped not failed.
            combined = (out + err).lower()
            if "already" in combined or "exists" in combined or "duplicate" in combined:
                print(f"   ⏭  already exists (set FORCE=1 to recreate)")
                skipped += 1
            else:
                snippet = (err.strip() or out.strip())[:250]
                print(f"   ❌ failed: {snippet}")
                failed += 1
        else:
            # Parse the JSON output to extract the new job ID (if --json worked)
            new_id = None
            try:
                import re
                m = re.search(r"\{[\s\S]*\}", out)
                if m:
                    payload = json.loads(m.group())
                    new_id = payload.get("id")
            except Exception:
                pass
            if new_id:
                print(f"   ✅ created ({new_id[:8]}...)")
            else:
                print(f"   ✅ created")
            created += 1

        print()

    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"🦞 Summary: created={created} skipped={skipped} failed={failed}")
    if unmapped:
        print("   Unmapped personas (fix config/personas-to-agents.json):")
        for hb_id, skill in unmapped:
            print(f"     - {hb_id} → skill {skill}")
    print()

    if DRY_RUN:
        print("Dry run — no mutations. Remove DRY_RUN=1 to actually provision.")
        return 0

    if failed > 0:
        return 2

    print("✅ Done. Verify with: openclaw cron list")
    print()
    print("Useful follow-ups:")
    print("  openclaw cron list                    # see all scheduled jobs")
    print("  openclaw cron status                  # scheduler health")
    print("  openclaw tasks list --runtime cron    # see recent run history")
    print("  openclaw cron run <id>                # manually trigger a specific job (debug)")
    print("  openclaw cron rm <id>                 # remove a job by id")
    return 0


if __name__ == "__main__":
    sys.exit(main())
