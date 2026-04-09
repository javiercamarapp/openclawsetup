# agents/ — OpenClaw workspace system prompts (v3 topology)

This directory is the **source of truth** for the system prompts that
OpenClaw injects into each agent workspace when a cron wakes them up.
There is one subdirectory per active agent (24 total), each containing
a single `AGENTS.md` file. A thin bash deploy script copies them into
`~/.openclaw/agents/<name>/workspace/AGENTS.md` on the Mac Mini where
OpenClaw actually runs.

## Why this exists

Before this commit, the 24 workspaces were empty. When the
`watchtower-health` cron (or any of the other 12 heartbeats) woke an
agent, the underlying LLM got no system prompt and defaulted to the
generic assistant voice — `"I couldn't find a previously scheduled
task"` and other useless outputs. Each `AGENTS.md` now tells the agent
exactly which persona it is encarnating, what the output contract is,
and what constraints apply, so the 13 heartbeats produce structured,
actionable results.

## Why the filename is AGENTS.md

`AGENTS.md` is an open de-facto standard (https://agents.md/) adopted
by OpenAI Codex, Cursor, Jules, Aider and others for project-root
context files. OpenClaw reuses the filename because it lives inside
the per-agent `workspace/` directory and is the first file the
gateway loads when initializing a session. We are slightly off-label
from the canonical use (which is project-context, not
system-prompts), but the filename + loader path matches what
OpenClaw 2026.4.5 expects.

---

## Business context block

This paragraph is **copied verbatim** into the `# BUSINESS CONTEXT`
section of every single `AGENTS.md` in this directory. Do not drift —
if a new fact is added here, every file must be updated in the same
commit.

> **Operator**: Javier Cámara (@javiercamarapp), Contador Público, based
> in Mérida, Yucatán, México. **Working companies**: Kairotec (AI
> consulting agency, $5K–50K USD projects), atiende.ai (WhatsApp + Voice
> AI for Mexican SMBs, $49–299 USD/mo), Opero (last-mile delivery
> serving ~80K contacts in Mérida), HatoAI (livestock management SaaS
> for ranchers), Moni AI (gamified personal finance fintech targeting
> LatAm), SELLO (identity/brand work). **Default language**: Mexican
> Spanish (es-MX) for client-facing output and internal comms;
> technical code terms stay in English. **Time zone**: America/Merida
> (CST, UTC−6, no DST). **Currency default**: MXN, with USD for
> cross-border pricing. **Cost tier awareness**: every persona knows
> whether it is running on a FREE, LOCAL, PAID or PREMIUM model and
> adjusts length/verbosity accordingly — FREE personas aim for terse
> answers, PREMIUM personas can take their time.

---

## Directory layout

```
agents/
├── _TEMPLATE.md              # reference template, not deployed
├── README.md                 # this file
├── premium/AGENTS.md         # 2 personas: PROPUESTA, SOCIAL
├── grok-sales/AGENTS.md      # 6 personas (HUNTER, VOZ, RETAIN, CLOSER, UPSELL, DEALFLOW)
├── qwen-general/AGENTS.md    # 10 personas — biggest file
├── gemini-lite/AGENTS.md     # 8 personas
├── hermes-405b/AGENTS.md     # 3 personas
├── gemma-vision/AGENTS.md    # 2 personas
├── trinity-creative/AGENTS.md
├── kimi-frontend/AGENTS.md
├── minimax-code/AGENTS.md
├── qwen-coder/AGENTS.md
├── deepseek-code/AGENTS.md
├── nemotron-security/AGENTS.md
├── qwen-finance/AGENTS.md
├── grok-legal/AGENTS.md
├── gpt-oss/AGENTS.md
├── gemini-flash/AGENTS.md
├── stepfun/AGENTS.md
├── llama-translate/AGENTS.md
├── local-text/AGENTS.md
├── glm-tools/AGENTS.md
├── gpt-oss-20b/AGENTS.md
├── gemma-12b/AGENTS.md
├── kimi-thinking/AGENTS.md
└── qwen-coder-flash/AGENTS.md
```

24 agents total (matching `config/personas-to-agents.json` minus
`hermes-405b-paid` which is RESERVED, and the OpenClaw default `main`
which has no workspace of its own).

## Mapping v1 → v3

The prompts inherit from the 50 v1 agents originally defined in
`BLUEPRINT_FULL (1).md` → PARTE 3B. The v3 topology consolidates them
into 24 LLM-instance agents each hosting multiple personas. 48 of the
50 v1 agents map cleanly into v3 personas; 26 new personas were added
for coverage gaps; 2 v1 agents are **orphaned** (see below).

Exact persona count: ~75 across the 24 files. Each persona name
appears in exactly one `AGENTS.md`.

## Deferred from v1 (orphans)

Two v1 agents are intentionally not carried into v3 and do not have
a dedicated persona anywhere:

- **APEX** (v1 lead architect). Its charter (ADRs, system-level
  design, senior code review) is absorbed semantically by two v3
  personas:
  - `ARCHITECT` in `deepseek-code` — handles feature-level system
    design, Supabase schemas, API contracts.
  - `ARCHITECT-DEEP` in `kimi-thinking` — handles multi-step
    trade-off analysis, migration planning, capacity decisions.
  If Javier wants the APEX charter preserved as a single entity, a
  follow-up commit can add an `APEX` persona to `kimi-thinking`.

- **PLANTA** (v1 ice factory + Opero delivery logistics). Genuinely
  dropped in v3 because the operational routing work is not currently
  happening through OpenClaw. Recoverable if the ice factory vertical
  or Opero delivery optimization needs an AI agent in the future — a
  new entry in `config/personas-to-agents.json` + a new `AGENTS.md`
  under `agents/planta/` would suffice.

## Deploy workflow

From the repo root on the Mac Mini where OpenClaw is installed:

```bash
# preview what will change
bash scripts/deploy_agent_prompts.sh --dry-run

# actually copy to ~/.openclaw/agents/*/workspace/
bash scripts/deploy_agent_prompts.sh

# verify
find ~/.openclaw/agents/*/workspace/AGENTS.md 2>/dev/null | wc -l
# expected: 24
```

The script is **idempotent** by default: if a destination file
already exists and differs from the source, the script refuses to
overwrite it unless `--force` is passed, so a hand-edited workspace
never gets silently clobbered.

## Editing workflow

When changing a prompt:

1. Edit `agents/<name>/AGENTS.md` in this repo.
2. Commit and push.
3. Pull on the Mac Mini and re-run `bash scripts/deploy_agent_prompts.sh`.
4. If you had previously hand-edited the workspace file, the script
   will error until you either (a) port your edits back into the repo
   or (b) pass `--force` to clobber the workspace copy.

Never edit `~/.openclaw/agents/<name>/workspace/AGENTS.md` directly on
the Mac — edits get silently lost on the next deploy.

## Versioning convention

- The persona template version lives at the top of `_TEMPLATE.md`.
- Breaking structural changes (renaming sections, dropping personas)
  should bump a `CHANGELOG.md` entry in this directory (not yet
  created — add it on first breaking change).
- Non-breaking edits (tightening a CONSTRAINT, improving an EXAMPLE)
  don't require a changelog entry but should be explained in the
  commit message.

## Related files

- `config/personas-to-agents.json` — source of truth for the v3
  topology (25 entries including RESERVED). Persona names in the
  `AGENTS.md` files must exactly match `agents.<name>.personas[]`.
- `config/heartbeats.json` — the 13 cron schedules that wake these
  agents. Each heartbeat's `skill` field must correspond to a persona
  name in the target agent's `AGENTS.md`.
- `BLUEPRINT_FULL (1).md` → PARTE 3B — the v1 original system prompts
  used as baseline for the 48 inherited personas.
- `CLAUDE_CODE_INSTRUCTIONS_v3.md` → PASO 7 "Lecciones aprendidas" —
  the OpenClaw 2026.4.5 quirks discovered during Bloque 2 (context
  bloat, `--light-context`, `--tools read`, per-agent model routing
  vs global default, etc.).
