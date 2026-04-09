# Supabase cache — FASE 1 notes

## Why the schema diverges from `CLAUDE_MD_EMPRESA_COMPLETO.md`

The blueprint for FASE 1 was written in the v1/v2 era (50 skills, REST
`/skills`, 8 hardcoded division names). Bloque 2 closed with the v3 topology
(25 agents, ~75 personas, WebSocket JSON-RPC gateway, 16 distinct division
strings), so this session adapted the schema accordingly before writing
any migration. The three concrete deltas:

1. **25 agents per sprite, not 50 skills.** Each sprite in the pixel world
   maps to one OpenClaw agent (as listed in `openclaw.json` →
   `agents.list[]` and in `../config/personas-to-agents.json`), not to a
   persona. Personas are prompt templates inside the agent, not runtime
   entities. `agent_positions.code` holds the lowercase agent id
   (`premium`, `grok-sales`, `qwen-general`), not the uppercase persona
   code (`FORGE`, `HUNTER`, `PROPUESTA`).

2. **No `GET /skills` REST endpoint.** OpenClaw 2026.4.5 is WebSocket
   JSON-RPC only. The FASE 2 sync script that populates `agent_positions`
   should call `openclaw agents list --json` as a subprocess (simpler, no
   WS auth needed) and fall back to the WS RPC method only if subprocess
   isn't available. This is explicitly NOT a FASE 1 concern — the schema
   just provides the table to fill.

3. **16 division strings → 9 visual zones.** The `division` field in
   `personas-to-agents.json` is free-text and has 16 distinct values
   (including one empty on `hermes-405b-paid`). The pixel world layout
   collapses these into 9 zones for 24 sprites (hermes-405b-paid is
   skipped as RESERVED). Final mapping is locked below.

---

## Final 9-zone layout (24 sprites) — LOCKED

Approved by Javier 2026-04-09. Source of truth for FASE 2 sync script and
FASE 4.5 sprite factory. Do not re-debate in subsequent sessions unless a
new agent is added to `personas-to-agents.json`.

| Zone # | Name            | Agents                                                                                           | Count |
|-------:|-----------------|--------------------------------------------------------------------------------------------------|------:|
|      1 | Code Ops        | `kimi-frontend`, `minimax-code`, `qwen-coder`, `deepseek-code`, `kimi-thinking`, `qwen-coder-flash` |   6   |
|      2 | Revenue / Sales | `grok-sales`                                                                                     |   1   |
|      3 | Brand & Content | `premium`, `hermes-405b`, `gemma-vision`, `trinity-creative`                                     |   4   |
|      4 | Ops & Finance   | `qwen-finance`, `grok-legal`                                                                     |   2   |
|      5 | Product & Growth| `gpt-oss-20b`                                                                                    |   1   |
|      6 | AI Ops          | `gpt-oss`, `glm-tools`, `nemotron-security`                                                      |   3   |
|      7 | Strategy        | `gemini-flash`, `stepfun`                                                                        |   2   |
|      8 | Comms & Lang    | `llama-translate`, `local-text`, `gemma-12b`                                                     |   3   |
|      9 | Workhorse       | `qwen-general`, `gemini-lite`                                                                    |   2   |

**Total: 24 sprites** (not 25).

### Non-obvious placement decisions

- **`deepseek-code` → Code Ops** (not AI Ops/Analytics): half its personas
  are SUPABASE/SQL/ARCHITECT (engineering), half are SPLIT/METRICS/GROWTH-HACK
  (analytics). Its tooling lives with the engineering stack, so visually it
  belongs with the Code Ops cluster.
- **`nemotron-security` → AI Ops** (not Code Ops): its personas are
  SHIELD/TRIAGE/AI-MONITOR — security and monitoring, not code generation.
- **`glm-tools` → AI Ops** (not Product): its personas (NEXUS, WEBHOOK) are
  orchestration infrastructure, conceptually closer to AI Ops than to
  product/growth.
- **`premium` → Brand & Content** (not Revenue): its personas are PROPUESTA
  and SOCIAL. PROPUESTA is proposal writing (brand-adjacent), SOCIAL is
  thought leadership content. Revenue zone keeps only `grok-sales` which
  has pure-sales personas (HUNTER, VOZ, CLOSER, UPSELL).
- **`hermes-405b-paid` → SKIPPED**: it's a RESERVED placeholder in
  `config/personas-to-agents.json` (the Bloque 2 `create_agents_v3.sh`
  script skips it because of its `_note: "RESERVED"`). Not provisioned in
  `~/.openclaw/agents/`. FASE 2 `sync-agents.ts` must skip it by default
  and only render a sprite if it ever appears in `openclaw agents list`.

### Zone-level stats

- **Visual density**: Code Ops (6) is the biggest cluster. Revenue (1) and
  Product (1) are single-sprite zones — they'll look sparse in the canvas
  layout. Consider adjusting zone sizes in FASE 4.5 so the density is
  visually balanced.
- **Persona totals**: 78 personas across 24 agents (kept out of the table
  for readability). `qwen-general` (10) and `gemini-lite` (8) in the
  Workhorse zone concentrate 18 personas in 2 sprites.

---

## Deferred to later FASEs

| Item                             | FASE | Reason |
|----------------------------------|-----:|--------|
| `scripts/sync-agents.ts`         | 2    | Needs the subprocess-based OpenClaw client, out of scope for schema-only FASE 1. |
| `supabase gen types typescript`  | 1.5  | Requires the migration to be applied (needs project ref + `supabase link`). Until then `src/lib/supabase/types.ts` is hand-written. |
| Zone coordinate calculation      | 4.5  | Sprite factory. The `division INTEGER` column is nullable precisely because we don't need to decide 1..8 → (x,y,w,h) until then. |
| RLS policies                     | 8    | Single-user for now, RLS disabled. Revisit if the dashboard ever becomes multi-user. |
| Realtime subscriptions           | 3    | `world_events` is the intended Supabase Realtime source for the pixel world canvas. The broadcast setup is FASE 3. |

---

## What Javier needs to do to apply this migration

Once you have the Supabase project ref and keys in `.env.local`, run these
paste-safe commands one at a time from `~/openclawsetup/dashboard/`:

```
npx supabase link --project-ref YOUR_PROJECT_REF
```

(The first run will prompt for your Supabase access token — get it from
`https://supabase.com/dashboard/account/tokens`.)

```
npx supabase db push
```

This applies `20260409120000_initial_schema.sql` to the cloud project.
After it succeeds, regenerate the types:

```
npx supabase gen types typescript --linked > src/lib/supabase/types.ts
```

Then verify all 6 tables exist:

```
npx supabase db dump --schema public --data-only=false | grep "CREATE TABLE"
```

You should see 6 `CREATE TABLE` lines: `agent_positions`, `conv_log`,
`msg_log`, `tasks`, `costs_log`, `world_events`. All with RLS disabled.

**Do NOT run `supabase db reset`** — it drops everything. Only use
`db push` for forward migrations.

---

## Resolved design decisions — LOCKED

All four questions from the initial draft have been answered. Source of
truth for FASE 2/4.5. Do not re-debate.

### 1. Zone collapse → 9 zones, 24 sprites

See the "Final 9-zone layout" table above. Non-obvious placements
(deepseek-code, nemotron-security, glm-tools, premium) are explained
inline with that table.

### 2. `qwen-general` → fixed in Workhorse zone, no pathfinding

`qwen-general` stays in the Workhorse zone permanently. No walking between
zones based on which persona it's currently serving. Rationale: visual
clarity beats literal accuracy — a sprite that teleports between 8 zones
confuses the read of the pixel world. If Javier wants to see the personas
that `qwen-general` is driving, that exposes via **click-to-expand modal**
in FASE 6 (not via pathfinding). Same rule applies to `gemini-lite`.

### 3. Tier-based sprite coloring → YES, border-only

Each sprite gets a 1-2px outline in the color matching its `tier` field
from `config/personas-to-agents.json`. No fill change (the pixel art base
stays untouched). This gives read-at-a-glance cost awareness: purple
outlines = the expensive ones burning the monthly budget, green/blue =
free or local.

| tier      | border color | typical HEX | examples                                    |
|-----------|--------------|-------------|---------------------------------------------|
| `LOCAL`   | green        | `#10B981`   | `local-text` (ollama/qwen3:8b)              |
| `FREE`    | blue         | `#3B82F6`   | every `:free` model, ~15 agents             |
| `PAID`    | amber        | `#F59E0B`   | `grok-sales`, `gemini-lite`, `deepseek-code`, `kimi-frontend`, `qwen-finance`, `grok-legal`, `gemini-flash`, `kimi-thinking`, `qwen-coder-flash` |
| `PREMIUM` | purple       | `#A855F7`   | `premium` only (anthropic/claude-sonnet-4.6) |

Implementation: FASE 4.5 sprite factory reads `agent_positions` joined
with a tier lookup from `config/personas-to-agents.json` (or a new
`agent_metadata` column if we add one to `agent_positions` later) and
applies the border during render. No DB schema change needed for this.

### 4. `hermes-405b-paid` → skip, RESERVED

It's a reserved placeholder in `config/personas-to-agents.json` that was
never actually provisioned in `~/.openclaw/agents/` (the Bloque 2 v3
`create_agents_v3.sh` script skips it because of its `_note: "RESERVED"`).
FASE 2 `sync-agents.ts` must:

1. Default: skip any agent whose config entry has `_note: "RESERVED"` or
   whose `personas` array is empty.
2. Dynamic: if `openclaw agents list --json` returns `hermes-405b-paid`
   (meaning Javier activated it manually as a rate-limit fallback), the
   sync script inserts a row in `agent_positions` with `division = NULL`
   and the sprite renders in whichever zone the sync script assigns via
   a fallback rule (e.g. Brand, matching the primary `hermes-405b`).

No database constraint enforces this — the skip is pure application
logic in FASE 2.
