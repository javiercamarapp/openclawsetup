#!/usr/bin/env node
/**
 * sync-agents.ts — Bloque 3 FASE 2
 *
 * Populates `agent_positions` with the 24 active OpenClaw agents so
 * the pixel world has a row per sprite to render in FASE 5. This is
 * the only write to the dashboard DB that originates from the
 * OpenClaw side of the world; everything else flows through the
 * FASE 3 event subscriber.
 *
 * Usage (from `dashboard/`):
 *
 *   npm run sync:agents
 *
 * or directly:
 *
 *   npx tsx --env-file=.env.local scripts/sync-agents.ts
 *
 * Flags:
 *   --offline   Skip the `openclaw agents list --json` call and seed
 *               directly from `config/personas-to-agents.json`. Use
 *               this on machines where OpenClaw is not installed
 *               (CI, sandboxes, anywhere that isn't Javier's Mac).
 *   --dry-run   Print what would be inserted, no DB writes.
 *
 * Behavior:
 *   1. Loads `../config/personas-to-agents.json` (repo root), which
 *      defines 25 agents (24 active + 1 RESERVED).
 *   2. Unless --offline, calls `openclaw agents list --json` via the
 *      gateway CLI wrapper and intersects with the config. Agents in
 *      the config but missing from the gateway are skipped with a
 *      warning; agents in the gateway but missing from the config
 *      are likewise skipped (unknown agent, operator error).
 *   3. RESERVED handling (see supabase/NOTES.md §4): an agent whose
 *      config entry has `_note: "RESERVED"` or no `personas` is
 *      skipped by default. If the gateway actively reports it (the
 *      dynamic `hermes-405b-paid` rate-limit fallback case), it is
 *      promoted and included with division=null.
 *   4. Upserts one row per included agent into `agent_positions`
 *      using `ignoreDuplicates: true` so re-runs never clobber any
 *      coordinates that the FASE 5 pixel world has already written.
 *      First run inserts 24 rows; subsequent runs are no-ops unless
 *      a new agent has been added to the config.
 *
 * This script is read-only against OpenClaw and write-only against
 * the `agent_positions` table.
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  listAgentsViaCli,
  OpenClawCliError,
  type GatewayAgent,
} from "@/lib/gateway";
import { getServerSupabase } from "@/lib/supabase/server";

// ───────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────

interface PersonaAgentConfig {
  model?: string;
  tier?: string;
  cost_mo?: number;
  ctx?: number;
  personas?: string[];
  division?: string;
  _note?: string;
}

interface PersonasConfig {
  _meta?: Record<string, unknown>;
  agents: Record<string, PersonaAgentConfig>;
}

// ───────────────────────────────────────────────────────────────────
// Args
// ───────────────────────────────────────────────────────────────────

const argv = new Set(process.argv.slice(2));
const OFFLINE = argv.has("--offline");
const DRY_RUN = argv.has("--dry-run");

/**
 * Agent names the gateway legitimately reports but that are NOT
 * sprites — silenced in the reconcile loop to avoid noisy warnings.
 *
 * - `main`: the default agent created by `openclaw onboard`, used
 *   for interactive admin/debug calls. Not part of the empresa
 *   virtual topology. See BLOQUE_3_KICKOFF.md.
 */
const GATEWAY_NON_SPRITE_AGENTS = new Set<string>(["main"]);

// ───────────────────────────────────────────────────────────────────
// Paths
// ───────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// scripts/sync-agents.ts → dashboard/scripts/ → dashboard/ → repo-root
// → config/personas-to-agents.json
const CONFIG_PATH = resolve(
  __dirname,
  "..",
  "..",
  "config",
  "personas-to-agents.json",
);

// ───────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log(
    `[sync-agents] mode: ${OFFLINE ? "offline" : "live"}${DRY_RUN ? " +dry-run" : ""}`,
  );

  const config = await loadPersonasConfig();
  const totalInConfig = Object.keys(config.agents).length;
  log(
    `[sync-agents] loaded ${totalInConfig} agents from ${CONFIG_PATH}`,
  );

  // Figure out the target set.
  let targetNames: string[];
  if (OFFLINE) {
    targetNames = Object.entries(config.agents)
      .filter(([, cfg]) => isActive(cfg))
      .map(([name]) => name);
    log(
      `[sync-agents] offline mode: ${targetNames.length} active agents from config`,
    );
  } else {
    const gatewayAgents = await safeListGateway();
    if (gatewayAgents === null) {
      log(
        "[sync-agents] gateway unavailable, falling back to config-only seed",
      );
      targetNames = Object.entries(config.agents)
        .filter(([, cfg]) => isActive(cfg))
        .map(([name]) => name);
    } else {
      const gatewayNames = new Set(gatewayAgents.map((a) => a.name));
      log(
        `[sync-agents] gateway reports ${gatewayNames.size} live agents`,
      );
      targetNames = reconcile(config.agents, gatewayNames);
    }
  }

  if (targetNames.length === 0) {
    warn("[sync-agents] no agents to sync — nothing to do");
    return;
  }

  log(`[sync-agents] target sprites: ${targetNames.length}`);

  // Upsert.
  if (DRY_RUN) {
    log("[sync-agents] dry-run, would upsert:");
    for (const name of targetNames) log(`  - ${name}`);
    return;
  }

  const supabase = getServerSupabase();
  const rows = targetNames.map((name) => ({
    code: name,
    division: null,
  }));

  const { data, error } = await supabase
    .from("agent_positions")
    .upsert(rows, { onConflict: "code", ignoreDuplicates: true })
    .select("code");

  if (error) {
    fail(`[sync-agents] upsert failed: ${error.message}`);
  }

  const insertedCount = data?.length ?? 0;
  const skippedCount = targetNames.length - insertedCount;
  log(
    `[sync-agents] upsert ok — inserted=${insertedCount} existing=${skippedCount}`,
  );
  if (insertedCount > 0 && data) {
    for (const row of data) log(`  + ${row.code}`);
  }
  log("[sync-agents] done");
}

// ───────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────

async function loadPersonasConfig(): Promise<PersonasConfig> {
  let raw: string;
  try {
    raw = await readFile(CONFIG_PATH, "utf-8");
  } catch (err) {
    fail(
      `[sync-agents] cannot read ${CONFIG_PATH}: ${(err as Error).message}`,
    );
  }
  let parsed: PersonasConfig;
  try {
    parsed = JSON.parse(raw) as PersonasConfig;
  } catch (err) {
    fail(
      `[sync-agents] invalid JSON in ${CONFIG_PATH}: ${(err as Error).message}`,
    );
  }
  if (!parsed.agents || typeof parsed.agents !== "object") {
    fail(`[sync-agents] ${CONFIG_PATH} missing top-level "agents" object`);
  }
  return parsed;
}

/**
 * An agent is "active" (should be synced) if it has a non-empty
 * `personas` array and its config entry is not flagged RESERVED.
 * See `dashboard/supabase/NOTES.md` §4 for the full rule.
 */
function isActive(cfg: PersonaAgentConfig): boolean {
  if (typeof cfg._note === "string" && cfg._note.includes("RESERVED")) {
    return false;
  }
  if (!Array.isArray(cfg.personas) || cfg.personas.length === 0) {
    return false;
  }
  return true;
}

/**
 * Cross-references the full config with the set of agent names the
 * gateway is currently reporting. Returns the list of agent names
 * to include in `agent_positions`.
 *
 * Rules:
 *   - active in config + live in gateway         → include
 *   - active in config + missing from gateway    → warn, skip
 *   - inactive in config + live in gateway       → promote (RESERVED
 *                                                   dynamic case), warn
 *   - unknown in gateway, not in config at all   → warn, skip
 */
function reconcile(
  configAgents: Record<string, PersonaAgentConfig>,
  gatewayNames: Set<string>,
): string[] {
  const targets: string[] = [];
  const handled = new Set<string>();

  for (const [name, cfg] of Object.entries(configAgents)) {
    const active = isActive(cfg);
    const live = gatewayNames.has(name);

    if (active && live) {
      targets.push(name);
      handled.add(name);
    } else if (active && !live) {
      warn(
        `[sync-agents] "${name}" active in config but missing from gateway — skipping`,
      );
    } else if (!active && live) {
      warn(
        `[sync-agents] promoting RESERVED/inactive "${name}" (live in gateway)`,
      );
      targets.push(name);
      handled.add(name);
    }
    // !active && !live → genuinely skipped, no log needed
  }

  for (const name of gatewayNames) {
    if (!handled.has(name) && !(name in configAgents)) {
      if (GATEWAY_NON_SPRITE_AGENTS.has(name)) continue;
      warn(
        `[sync-agents] gateway reports unknown agent "${name}" not in config — skipping`,
      );
    }
  }

  return targets;
}

async function safeListGateway(): Promise<GatewayAgent[] | null> {
  try {
    return await listAgentsViaCli();
  } catch (err) {
    if (err instanceof OpenClawCliError) {
      warn(`[sync-agents] ${err.message}`);
      return null;
    }
    throw err;
  }
}

function log(msg: string): void {
  console.log(msg);
}

function warn(msg: string): void {
  console.warn(msg);
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

// ───────────────────────────────────────────────────────────────────
// Run
// ───────────────────────────────────────────────────────────────────

main().catch((err: unknown) => {
  console.error("[sync-agents] fatal:", err);
  process.exit(1);
});
