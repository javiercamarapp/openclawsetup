/**
 * Gateway types — Bloque 3 FASE 2
 *
 * Shared types for the OpenClaw gateway clients. Kept in a separate
 * file (no runtime imports) so it can be consumed from both the
 * server-only subprocess wrapper and any future browser-safe
 * read-only view layer without dragging `node:child_process` into
 * the client bundle.
 */

/**
 * A single agent as reported by the OpenClaw gateway.
 *
 * `name` is the authoritative agent id: the lowercase directory name
 * under `~/.openclaw/agents/<name>/`, the key under `agents` in
 * `config/personas-to-agents.json`, and the value stored in
 * `agent_positions.code`. Uppercase persona codes (e.g. `FORGE`,
 * `HUNTER`) are NEVER used here — per `dashboard/supabase/NOTES.md`
 * §1, personas are prompt templates inside an agent, not runtime
 * entities.
 *
 * `model` is display-only. Per lesson 2 of the v3 instructions
 * (`CLAUDE_CODE_INSTRUCTIONS_v3.md`): `agents.list[i].model` in
 * `openclaw.json` is shown by `openclaw agents list` but the runtime
 * ignores it, so we treat it as metadata with no semantic weight.
 */
export interface GatewayAgent {
  name: string;
  model?: string;
}

/**
 * Thrown when the `openclaw` binary is missing, the subprocess fails
 * to spawn, or it exits with a non-zero code. `cause` is the raw
 * error from `child_process.execFile` so callers can inspect
 * `.code === "ENOENT"` or similar if they need finer-grained
 * recovery.
 */
export class OpenClawCliError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "OpenClawCliError";
  }
}

/**
 * Thrown when the CLI succeeds but its stdout can't be parsed into
 * `GatewayAgent[]`. `raw` is the full untouched stdout so the
 * operator can paste it back and refine the defensive parser in
 * `openclaw-cli.ts`.
 */
export class OpenClawParseError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
  ) {
    super(message);
    this.name = "OpenClawParseError";
  }
}
