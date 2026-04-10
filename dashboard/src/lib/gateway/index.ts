/**
 * Gateway module — Bloque 3 FASE 2 + FASE 3
 *
 * Barrel export for the OpenClaw gateway client. Import from
 * `@/lib/gateway` rather than the sub-files so the internal layout
 * can change without touching call sites.
 */

// FASE 2 — CLI subprocess wrapper (read-only, one-shot)
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

// FASE 3 — WebSocket event subscriber (long-running)
export { startOpenClawSubscriber } from "./ws-subscriber";
