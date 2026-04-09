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

3. **16 division strings → 8 visual zones.** The `division` field in
   `personas-to-agents.json` is free-text and has 16 distinct values
   (including one empty on `hermes-405b-paid`). The pixel world needs
   ≤ 8 zones for layout. Proposed collapse below — not committed, pending
   Javier's sign-off before any sync script runs.

---

## Proposed 8 + 1 zone collapse (for FASE 2 / FASE 4 to confirm)

| Zone # | Name           | Agents                                                                       | Persona count |
|-------:|----------------|------------------------------------------------------------------------------|--------------:|
|      1 | Code Ops       | `kimi-frontend`, `minimax-code`, `qwen-coder`, `kimi-thinking`, `qwen-coder-flash` | 12 |
|      2 | Revenue        | `premium`, `grok-sales`                                                      | 8  |
|      3 | Brand          | `hermes-405b`, `gemma-vision`, `trinity-creative`                            | 7  |
|      4 | Ops & Finance  | `qwen-finance`, `grok-legal`                                                 | 8  |
|      5 | Product        | `gpt-oss-20b`, `glm-tools`                                                   | 4  |
|      6 | AI Ops         | `nemotron-security`, `gpt-oss`, `deepseek-code`                              | 12 |
|      7 | Strategy       | `gemini-flash`, `stepfun`                                                    | 4  |
|      8 | Comms          | `llama-translate`, `local-text`, `gemma-12b`                                 | 5  |
|      9 | Workhorse      | `qwen-general`, `gemini-lite`, `hermes-405b-paid`                            | 18 |

**Rationale for a 9th "Workhorse" zone**: `qwen-general` (10 personas) and
`gemini-lite` (8 personas) are explicitly labeled "Multi-division" in the
config — they serve agents across all 8 zones. Forcing them into a single
fixed zone misrepresents their role. `hermes-405b-paid` has no personas
and no division; treat it as a spare/idle slot in the same zone until a
role is assigned.

Total: 25 agents, 78 personas. (The 75 in `personas-to-agents.json _meta`
rounds down; actual sum = 78.)

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

Then verify the tables exist:

```
npx supabase db list-tables
```

You should see 6 tables: `agent_positions`, `conv_log`, `msg_log`, `tasks`,
`costs_log`, `world_events`. All with RLS disabled.

**Do NOT run `supabase db reset`** — it drops everything. Only use
`db push` for forward migrations.

---

## Open design questions for Javier

1. **Confirm the 8+1 zone collapse above**, or propose a different
   grouping. This affects `scripts/sync-agents.ts` in FASE 2 and the
   `ZONES` constant in `src/lib/sprites/` in FASE 4.5.

2. **Where does `qwen-general` "live"?** It's the workhorse with 10
   personas across all 8 zones. Options:
   - (a) Fixed workhorse zone (current proposal)
   - (b) Walks between zones based on current persona
   - (c) Renders as a floating sprite above all zones
   Option (b) is most visually interesting but most complex to implement.

3. **Tier-based coloring?** Agents have a `tier` field
   (`PREMIUM|PAID|FREE|LOCAL`). Should sprites render with a border/halo
   color based on tier so Javier can tell at a glance which agents are
   costing him money?

4. **`hermes-405b-paid` handling.** It has no personas and no division.
   Is it a mistake (should be deleted from `personas-to-agents.json`) or
   a reserved slot? For now the schema accepts it as a valid row with
   `division = NULL`.
