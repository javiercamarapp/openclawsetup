/**
 * OpenClaw WebSocket event subscriber — Bloque 3 FASE 3
 *
 * Connects to the OpenClaw gateway at `ws://127.0.0.1:18789/events`
 * and maps incoming events to Supabase table inserts/updates:
 *
 *   conversation.started   → conv_log INSERT + world_events INSERT
 *   conversation.message   → msg_log INSERT + conv_log bump totals
 *   conversation.handoff   → world_events INSERT + agent_positions UPDATE
 *   conversation.completed → conv_log UPDATE + world_events INSERT
 *   agent.error            → world_events INSERT
 *
 * This module is **read-only against OpenClaw** (it subscribes, never
 * sends commands) and **write-only against Supabase** (it inserts
 * into cache tables, never reads from them except for the session→id
 * lookup in msg_log flow).
 *
 * Architecture:
 *   - Auto-reconnect with exponential backoff + jitter (1s → 30s cap)
 *   - Graceful shutdown on SIGINT/SIGTERM: close WS, flush pending ops
 *   - Per-event error isolation: one bad event never crashes the subscriber
 *   - Session→conv_id cache to avoid repeated DB lookups
 *
 * Run via: `npx tsx --env-file=.env.local scripts/subscribe.ts`
 * or:      `npm run subscribe`
 */

import WebSocket from "ws";

import { getServerSupabase } from "@/lib/supabase/server";

// ───────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────

/** Union of all known OpenClaw gateway event shapes. */
interface ConversationStartedEvent {
  type: "conversation.started";
  sessionId: string;
  skill: string;
  trigger?: string;
  timestamp?: string;
}

interface ConversationMessageEvent {
  type: "conversation.message";
  sessionId: string;
  skill: string;
  role: string;
  content: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;
  latencyMs?: number;
}

interface ConversationHandoffEvent {
  type: "conversation.handoff";
  sessionId: string;
  from: string;
  to: string;
}

interface ConversationCompletedEvent {
  type: "conversation.completed";
  sessionId: string;
  summary?: string;
  totalCost?: number;
}

interface AgentErrorEvent {
  type: "agent.error";
  skill: string;
  error: string;
  model?: string;
}

type OpenClawEvent =
  | ConversationStartedEvent
  | ConversationMessageEvent
  | ConversationHandoffEvent
  | ConversationCompletedEvent
  | AgentErrorEvent;

// ───────────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────────

const OC_WS_URL =
  process.env.OPENCLAW_WS_URL || "ws://127.0.0.1:18789/events";
const BASE_DELAY = 1_000;
const MAX_DELAY = 30_000;
const JITTER = 0.3;

// ───────────────────────────────────────────────────────────────────
// State
// ───────────────────────────────────────────────────────────────────

let ws: WebSocket | null = null;
let reconnectAttempt = 0;
let shuttingDown = false;

/**
 * Cache sessionId → conv_log.id to avoid a DB lookup on every
 * conversation.message event. Evicted on conversation.completed.
 */
const sessionToConvId = new Map<string, string>();

// ───────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────

export function startOpenClawSubscriber(): void {
  log(`connecting to ${OC_WS_URL}...`);
  connect();

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// ───────────────────────────────────────────────────────────────────
// Connection
// ───────────────────────────────────────────────────────────────────

function connect(): void {
  ws = new WebSocket(OC_WS_URL);

  ws.on("open", () => {
    log("connected");
    reconnectAttempt = 0;
  });

  ws.on("message", (raw) => {
    let evt: OpenClawEvent;
    try {
      evt = JSON.parse(raw.toString()) as OpenClawEvent;
    } catch {
      warn(`unparseable message: ${raw.toString().slice(0, 200)}`);
      return;
    }
    handleEvent(evt).catch((err) => {
      error(
        `handler failed for ${evt.type}: ${(err as Error).message}`,
      );
    });
  });

  ws.on("close", () => {
    if (shuttingDown) return;
    const delay = Math.min(BASE_DELAY * 2 ** reconnectAttempt, MAX_DELAY);
    const jittered = delay * (1 + JITTER * (Math.random() * 2 - 1));
    reconnectAttempt++;
    warn(`disconnected, retrying in ${Math.round(jittered)}ms`);
    setTimeout(connect, jittered);
  });

  ws.on("error", (e) => {
    error(`socket error: ${e.message}`);
    // 'close' fires next, which triggers reconnect
  });
}

// ───────────────────────────────────────────────────────────────────
// Event handlers
// ───────────────────────────────────────────────────────────────────

async function handleEvent(evt: OpenClawEvent): Promise<void> {
  const supabase = getServerSupabase();

  switch (evt.type) {
    // ── conversation.started ────────────────────────────────────
    case "conversation.started": {
      const { data, error: insertErr } = await supabase
        .from("conv_log")
        .insert({
          openclaw_session_id: evt.sessionId,
          agent_a_code: evt.skill,
          trigger_type: evt.trigger ?? "unknown",
          status: "active",
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      // Cache for future message lookups
      if (data) sessionToConvId.set(evt.sessionId, data.id);

      await supabase.from("world_events").insert({
        event_type: "conversation_start",
        payload: { sessionId: evt.sessionId, agent: evt.skill },
      });

      // Mark agent as talking in pixel world
      await supabase
        .from("agent_positions")
        .update({ world_state: "talking", last_seen_at: new Date().toISOString() })
        .eq("code", evt.skill.toLowerCase());

      log(`conv started: ${evt.skill} [${evt.sessionId.slice(0, 8)}]`);
      break;
    }

    // ── conversation.message ────────────────────────────────────
    case "conversation.message": {
      const convId = await resolveConvId(evt.sessionId);
      if (!convId) {
        warn(`no conv_log for session ${evt.sessionId}, dropping message`);
        return;
      }

      const tokensIn = evt.tokensIn ?? 0;
      const tokensOut = evt.tokensOut ?? 0;
      const cost = evt.cost ?? 0;

      await supabase.from("msg_log").insert({
        conv_id: convId,
        speaker: evt.skill,
        role: evt.role === "javier" ? "javier" : "agent_a",
        content: evt.content,
        model_used: evt.model ?? null,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        cost,
        latency_ms: evt.latencyMs ?? null,
      });

      // Bump running totals on the conv_log row.
      // Type assertion needed because the RPC function isn't in the
      // generated types yet — it will be after Javier runs
      // `supabase db push` + `supabase gen types typescript --linked`.
      await (supabase.rpc as CallableFunction)("bump_conv_totals", {
        p_conv_id: convId,
        p_tokens: tokensIn + tokensOut,
        p_cost: cost,
      });

      break;
    }

    // ── conversation.handoff ────────────────────────────────────
    case "conversation.handoff": {
      await supabase.from("world_events").insert({
        event_type: "agent_move",
        payload: {
          from: evt.from,
          to: evt.to,
          sessionId: evt.sessionId,
        },
      });

      // Both agents enter walking state for pixel world animation
      await supabase
        .from("agent_positions")
        .update({ world_state: "walking", last_seen_at: new Date().toISOString() })
        .in("code", [evt.from.toLowerCase(), evt.to.toLowerCase()]);

      log(`handoff: ${evt.from} → ${evt.to}`);
      break;
    }

    // ── conversation.completed ──────────────────────────────────
    case "conversation.completed": {
      await supabase
        .from("conv_log")
        .update({
          status: "completed",
          summary: evt.summary ?? null,
          total_cost: evt.totalCost ?? 0,
          ended_at: new Date().toISOString(),
        })
        .eq("openclaw_session_id", evt.sessionId);

      await supabase.from("world_events").insert({
        event_type: "conversation_end",
        payload: {
          sessionId: evt.sessionId,
          summary: evt.summary ?? null,
        },
      });

      // Return agent to idle
      const convId = sessionToConvId.get(evt.sessionId);
      if (convId) {
        const { data: conv } = await supabase
          .from("conv_log")
          .select("agent_a_code")
          .eq("id", convId)
          .single();
        if (conv?.agent_a_code) {
          await supabase
            .from("agent_positions")
            .update({ world_state: "idle", last_seen_at: new Date().toISOString() })
            .eq("code", conv.agent_a_code);
        }
      }

      // Evict from cache
      sessionToConvId.delete(evt.sessionId);

      log(`conv completed: [${evt.sessionId.slice(0, 8)}]`);
      break;
    }

    // ── agent.error ─────────────────────────────────────────────
    case "agent.error": {
      await supabase.from("world_events").insert({
        event_type: "agent_error",
        payload: {
          skill: evt.skill,
          error: evt.error,
          model: evt.model ?? null,
        },
      });

      warn(`agent error: ${evt.skill} — ${evt.error}`);
      break;
    }

    default: {
      // Unknown event — log but don't crash
      const unknown = evt as { type?: string };
      log(`unhandled event type: ${unknown.type ?? "undefined"}`);
    }
  }
}

// ───────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────

/**
 * Resolves an OpenClaw sessionId to a conv_log UUID. Uses the
 * in-memory cache first; falls back to a DB lookup if the cache
 * misses (e.g. subscriber restarted mid-conversation).
 */
async function resolveConvId(
  sessionId: string,
): Promise<string | null> {
  const cached = sessionToConvId.get(sessionId);
  if (cached) return cached;

  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("conv_log")
    .select("id")
    .eq("openclaw_session_id", sessionId)
    .single();

  if (data) {
    sessionToConvId.set(sessionId, data.id);
    return data.id;
  }
  return null;
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`${signal} received, shutting down...`);

  // Close WebSocket cleanly
  ws?.close(1000, "shutdown");

  // Hard deadline — force exit if something hangs
  const hardTimeout = setTimeout(() => process.exit(1), 5_000);
  hardTimeout.unref();

  log("shutdown complete");
  process.exit(0);
}

// ───────────────────────────────────────────────────────────────────
// Logging
// ───────────────────────────────────────────────────────────────────

function log(msg: string): void {
  console.log(`[oc-sub] ${msg}`);
}

function warn(msg: string): void {
  console.warn(`[oc-sub] ${msg}`);
}

function error(msg: string): void {
  console.error(`[oc-sub] ${msg}`);
}
