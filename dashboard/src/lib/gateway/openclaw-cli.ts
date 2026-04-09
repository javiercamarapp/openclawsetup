/**
 * OpenClaw CLI subprocess wrapper — Bloque 3 FASE 2 (read-only)
 *
 * Wraps `openclaw agents list --json` and returns a normalized
 * `GatewayAgent[]`. Read-only by construction: no mutating
 * subcommands are ever invoked from this module.
 *
 * Why subprocess instead of the WebSocket JSON-RPC gateway at
 * `ws://127.0.0.1:18789`? Per `dashboard/supabase/NOTES.md` §2,
 * subprocess is simpler and needs no WS auth setup. We only call
 * this during the one-off sync in `scripts/sync-agents.ts`, never
 * in a hot path, so the ~200ms fork cost is acceptable. A WS RPC
 * fallback is out of scope for FASE 2 — callers should catch
 * `OpenClawCliError` and decide how to proceed (sync-agents does).
 *
 * This module must only be imported from server-side code (Node
 * scripts, route handlers, server components). `node:child_process`
 * is not available in the browser bundle.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  type GatewayAgent,
  OpenClawCliError,
  OpenClawParseError,
} from "./types";

const execFileAsync = promisify(execFile);

export interface ListAgentsOptions {
  /** Path to the `openclaw` binary. Defaults to PATH lookup. */
  openclawBin?: string;
  /** Subprocess timeout in ms. Defaults to 10_000 (10s). */
  timeoutMs?: number;
}

/**
 * Run `openclaw agents list --json` and parse the output into
 * `GatewayAgent[]`.
 *
 * The exact JSON shape produced by OpenClaw 2026.4.5 is not
 * documented anywhere we have access to from the sandbox, and the
 * binary is not installed here so we can't introspect it live.
 * We defensively accept the three most likely shapes:
 *
 *   1. `{ "agents": [{ "name": "foo", "model": "..." }, ...] }`
 *      (mirrors `cron list --json` which is `{ "jobs": [...] }`
 *      per the rollback recipe in `CLAUDE_CODE_INSTRUCTIONS_v3.md`)
 *   2. `{ "agents": ["foo", "bar", ...] }` (name-only list)
 *   3. `[{ "name": "foo" }, ...]` (bare array of objects)
 *
 * and also accept `id` or `agent` as alternate keys for the name
 * field. If the output doesn't match any of these, throws
 * `OpenClawParseError` with the raw stdout so the operator can
 * paste it back and refine this parser.
 */
export async function listAgentsViaCli(
  options: ListAgentsOptions = {},
): Promise<GatewayAgent[]> {
  const { openclawBin = "openclaw", timeoutMs = 10_000 } = options;

  let stdout: string;
  try {
    const result = await execFileAsync(
      openclawBin,
      ["agents", "list", "--json"],
      { timeout: timeoutMs, maxBuffer: 1 << 20 }, // 1 MiB of JSON is plenty
    );
    stdout = result.stdout;
  } catch (err) {
    const enoent =
      err !== null &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: unknown }).code === "ENOENT";
    const message = enoent
      ? `\`${openclawBin}\` not found on PATH. Is OpenClaw installed on this machine?`
      : `\`${openclawBin} agents list --json\` failed.`;
    throw new OpenClawCliError(message, err);
  }

  return parseAgentsListOutput(stdout);
}

/**
 * Exported separately so it can be unit-tested with fixture JSON
 * once we get a real sample of `openclaw agents list --json` output.
 */
export function parseAgentsListOutput(stdout: string): GatewayAgent[] {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    throw new OpenClawParseError(
      "Empty stdout from `openclaw agents list --json`.",
      stdout,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    throw new OpenClawParseError(
      `Invalid JSON from \`openclaw agents list --json\`: ${(err as Error).message}`,
      stdout,
    );
  }

  // Shapes 1 & 2: { agents: [...] }
  if (
    parsed !== null &&
    typeof parsed === "object" &&
    "agents" in parsed &&
    Array.isArray((parsed as { agents: unknown }).agents)
  ) {
    return coerceAgentArray(
      (parsed as { agents: unknown[] }).agents,
      stdout,
    );
  }

  // Shape 3: bare array of agent objects
  if (Array.isArray(parsed)) {
    return coerceAgentArray(parsed, stdout);
  }

  throw new OpenClawParseError(
    "Unrecognized shape: expected `{ agents: [...] }` or a bare array.",
    stdout,
  );
}

function coerceAgentArray(
  arr: unknown[],
  rawStdout: string,
): GatewayAgent[] {
  return arr.map((item, i): GatewayAgent => {
    // Name-only shape: bare string entries
    if (typeof item === "string") {
      if (item.length === 0) {
        throw new OpenClawParseError(
          `Agents[${i}]: empty string is not a valid agent name.`,
          rawStdout,
        );
      }
      return { name: item };
    }

    // Object shape: { name | id | agent, model? }
    if (item !== null && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const nameCandidate = obj.name ?? obj.id ?? obj.agent;
      if (typeof nameCandidate === "string" && nameCandidate.length > 0) {
        const model = typeof obj.model === "string" ? obj.model : undefined;
        return model !== undefined
          ? { name: nameCandidate, model }
          : { name: nameCandidate };
      }
    }

    throw new OpenClawParseError(
      `Agents[${i}]: expected string or object with {name|id|agent}, got ${JSON.stringify(item)}`,
      rawStdout,
    );
  });
}
