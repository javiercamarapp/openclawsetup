/**
 * Gateway module — Bloque 3 FASE 2 (read-only)
 *
 * Barrel export for the OpenClaw gateway client. Import from
 * `@/lib/gateway` rather than the sub-files so the internal layout
 * can change without touching call sites.
 */

export {
  listAgentsViaCli,
  parseAgentsListOutput,
  type ListAgentsOptions,
} from "./openclaw-cli";

export {
  type GatewayAgent,
  OpenClawCliError,
  OpenClawParseError,
} from "./types";
