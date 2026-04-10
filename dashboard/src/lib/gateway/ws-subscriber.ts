/**
 * OpenClaw WebSocket event subscriber — Bloque 3 FASE 3
 *
 * Connects to the OpenClaw gateway at `ws://127.0.0.1:18789/events`,
 * completes the device-identity challenge-response handshake, and
 * maps incoming events to Supabase table inserts/updates:
 *
 *   conversation.started   → conv_log INSERT + world_events INSERT
 *   conversation.message   → msg_log INSERT + conv_log bump totals
 *   conversation.handoff   → world_events INSERT + agent_positions UPDATE
 *   conversation.completed → conv_log UPDATE + world_events INSERT
 *   agent.error            → world_events INSERT
 *
 * Protocol (reverse-engineered from the OpenClaw 2026.4.x Control UI):
 *   1. Connect to WS with Origin header
 *   2. Receive {type:"event", event:"connect.challenge", payload:{nonce}}
 *   3. Generate Ed25519 keypair, derive deviceId = SHA-256(publicKey).hex()
 *   4. Sign pipe-delimited payload: v2|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce
 *   5. Send {type:"req", id, method:"connect", params:{minProtocol:3, maxProtocol:3, client, role, scopes, caps, auth:{token}, device:{id, publicKey, signedAt, nonce, signature}}}
 *   6. Receive {type:"res", ok:true, payload:{type:"hello-ok"}} → connected
 *   7. Events arrive as {type:"event", event:"<name>", payload:{...}, seq:N}
 *
 * Run via: `npx tsx --env-file=.env.local scripts/subscribe.ts`
 * or:      `npm run subscribe`
 */

import { createHash } from "node:crypto";

import nacl from "tweetnacl";
import WebSocket from "ws";

import { getServerSupabase } from "@/lib/supabase/server";

// ───────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────

/** Gateway envelope — all messages have this shape. */
interface GatewayMessage {
  type: "event" | "res";
  [key: string]: unknown;
}

interface GatewayEvent {
  type: "event";
  event: string;
  payload: Record<string, unknown>;
  seq?: number;
}

interface GatewayResponse {
  type: "res";
  id: string;
  ok: boolean;
  payload?: Record<string, unknown>;
  error?: { code: string; message: string };
}

// ───────────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────────

const OC_WS_URL =
  process.env.OPENCLAW_WS_URL || "ws://127.0.0.1:18789/events";
const OC_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "";
const OC_ORIGIN =
  process.env.OPENCLAW_ORIGIN || "http://127.0.0.1:18789";

const BASE_DELAY = 1_000;
const MAX_DELAY = 30_000;
const JITTER = 0.3;
const CLIENT_ID = "openclaw-tui";
const CLIENT_MODE = "webchat";
const ROLE = "operator";
const SCOPES = ["operator.read"];

// ───────────────────────────────────────────────────────────────────
// Device identity (generated once per process lifetime)
// ───────────────────────────────────────────────────────────────────

const keyPair = nacl.sign.keyPair();
const deviceId = createHash("sha256")
  .update(keyPair.publicKey)
  .digest("hex");
const publicKeyB64url = Buffer.from(keyPair.publicKey).toString(
  "base64url",
);

// ───────────────────────────────────────────────────────────────────
// State
// ───────────────────────────────────────────────────────────────────

let ws: WebSocket | null = null;
let reconnectAttempt = 0;
let shuttingDown = false;
let reqCounter = 0;
let authenticated = false;

const sessionToConvId = new Map<string, string>();
const seenEventTypes = new Set<string>();

// ───────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────

export function startOpenClawSubscriber(): void {
  if (!OC_GATEWAY_TOKEN) {
    console.error(
      "[oc-sub] OPENCLAW_GATEWAY_TOKEN not set. Add it to dashboard/.env.local",
    );
    process.exit(1);
  }
  log(`connecting to ${OC_WS_URL}...`);
  connect();

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// ───────────────────────────────────────────────────────────────────
// Connection + handshake
// ───────────────────────────────────────────────────────────────────

function connect(): void {
  authenticated = false;
  ws = new WebSocket(OC_WS_URL, {
    headers: { Origin: OC_ORIGIN },
  });

  ws.on("open", () => {
    log("socket open, waiting for challenge...");
    reconnectAttempt = 0;
  });

  ws.on("message", (raw) => {
    let msg: GatewayMessage;
    try {
      msg = JSON.parse(raw.toString()) as GatewayMessage;
    } catch {
      warn(`unparseable: ${raw.toString().slice(0, 200)}`);
      return;
    }

    if (msg.type === "event") {
      const evt = msg as unknown as GatewayEvent;

      // Handle challenge before anything else
      if (evt.event === "connect.challenge") {
        const nonce =
          typeof evt.payload?.nonce === "string"
            ? evt.payload.nonce
            : null;
        if (nonce) {
          sendConnect(nonce);
        } else {
          warn("challenge without nonce");
        }
        return;
      }

      // Skip events until authenticated
      if (!authenticated) return;

      // Route business events
      handleBusinessEvent(evt).catch((err) => {
        error(`handler failed for ${evt.event}: ${(err as Error).message}`);
      });
    } else if (msg.type === "res") {
      const res = msg as unknown as GatewayResponse;
      if (res.ok && (res.payload as Record<string, unknown>)?.type === "hello-ok") {
        authenticated = true;
        log("authenticated — listening for events");
      } else if (!res.ok && res.error) {
        error(`connect rejected: ${res.error.message}`);
      }
    }
  });

  ws.on("close", () => {
    authenticated = false;
    if (shuttingDown) return;
    const delay = Math.min(BASE_DELAY * 2 ** reconnectAttempt, MAX_DELAY);
    const jittered = delay * (1 + JITTER * (Math.random() * 2 - 1));
    reconnectAttempt++;
    warn(`disconnected, retrying in ${Math.round(jittered)}ms`);
    setTimeout(connect, jittered);
  });

  ws.on("error", (e) => {
    error(`socket error: ${e.message}`);
  });
}

function sendConnect(nonce: string): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const now = Date.now();
  const scopesStr = SCOPES.join(",");

  // Canonical signing payload (pipe-delimited, v2 protocol)
  const sigPayload = [
    "v2",
    deviceId,
    CLIENT_ID,
    CLIENT_MODE,
    ROLE,
    scopesStr,
    String(now),
    OC_GATEWAY_TOKEN,
    nonce,
  ].join("|");

  const sigBytes = nacl.sign.detached(
    new TextEncoder().encode(sigPayload),
    keyPair.secretKey,
  );

  const id = String(++reqCounter);
  const req = {
    type: "req",
    id,
    method: "connect",
    params: {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: CLIENT_ID,
        version: "1.0",
        platform: "node",
        mode: CLIENT_MODE,
      },
      role: ROLE,
      scopes: SCOPES,
      caps: ["tool-events"],
      auth: { token: OC_GATEWAY_TOKEN },
      device: {
        id: deviceId,
        publicKey: publicKeyB64url,
        signedAt: now,
        nonce,
        signature: Buffer.from(sigBytes).toString("base64url"),
      },
      userAgent: "openclaw-dashboard-subscriber/1.0",
      locale: "es-MX",
    },
  };

  ws.send(JSON.stringify(req));
  log("handshake sent");
}

// ───────────────────────────────────────────────────────────────────
// Business event handlers
// ───────────────────────────────────────────────────────────────────

async function handleBusinessEvent(evt: GatewayEvent): Promise<void> {
  const supabase = getServerSupabase();
  const p = evt.payload;

  switch (evt.event) {
    // ── agent lifecycle (start / end of an agent run) ───────────
    case "agent": {
      const runId = p.runId as string;
      const sessionKey = (p.sessionKey as string) ?? "";
      const data = p.data as Record<string, unknown> | undefined;
      const stream = p.stream as string | undefined;

      // Extract agent name from sessionKey: "agent:<name>:cron:<jobId>"
      const agentCode = parseAgentFromSessionKey(sessionKey);

      if (stream === "lifecycle" && data?.phase === "start") {
        // Agent run started → create conv_log entry
        const { data: row, error: insertErr } = await supabase
          .from("conv_log")
          .insert({
            openclaw_session_id: runId,
            agent_a_code: agentCode,
            trigger_type: sessionKey.includes(":cron:") ? "heartbeat" : "manual",
            status: "active",
          })
          .select("id")
          .single();
        if (insertErr) throw insertErr;
        if (row) sessionToConvId.set(runId, row.id);

        await supabase.from("world_events").insert({
          event_type: "conversation_start",
          payload: { runId, agent: agentCode, sessionKey },
        });

        if (agentCode) {
          await supabase
            .from("agent_positions")
            .update({
              world_state: "talking",
              last_seen_at: new Date().toISOString(),
            })
            .eq("code", agentCode);
        }

        log(`agent start: ${agentCode ?? "unknown"} [${runId.slice(0, 8)}]`);
      } else if (stream === "lifecycle" && (data?.phase === "end" || data?.phase === "complete")) {
        // Agent run ended → update conv_log
        await supabase
          .from("conv_log")
          .update({
            status: "completed",
            ended_at: new Date().toISOString(),
          })
          .eq("openclaw_session_id", runId);

        await supabase.from("world_events").insert({
          event_type: "conversation_end",
          payload: { runId, agent: agentCode },
        });

        if (agentCode) {
          await supabase
            .from("agent_positions")
            .update({
              world_state: "idle",
              last_seen_at: new Date().toISOString(),
            })
            .eq("code", agentCode);
        }

        sessionToConvId.delete(runId);
        log(`agent end: ${agentCode ?? "unknown"} [${runId.slice(0, 8)}]`);
      }
      // Other agent sub-events (tool calls, etc.) — log for discovery
      else if (!seenEventTypes.has(`agent:${stream}:${data?.phase}`)) {
        seenEventTypes.add(`agent:${stream}:${data?.phase}`);
        log(`agent sub-event: stream=${stream} phase=${data?.phase} — ${JSON.stringify(evt).slice(0, 300)}`);
      }
      break;
    }

    // ── chat (messages, errors, model responses) ────────────────
    case "chat": {
      const runId = p.runId as string;
      const state = p.state as string | undefined;
      const sessionKey = (p.sessionKey as string) ?? "";
      const agentCode = parseAgentFromSessionKey(sessionKey);

      if (state === "error") {
        // Error event → world_events
        const errorMsg = (p.errorMessage as string) ?? "unknown error";
        await supabase.from("world_events").insert({
          event_type: "agent_error",
          payload: {
            runId,
            agent: agentCode,
            error: errorMsg,
          },
        });
        warn(`chat error: ${agentCode} — ${errorMsg.slice(0, 120)}`);
      } else {
        // Message content → msg_log (if we can resolve the conv)
        const convId = await resolveConvId(runId);
        if (convId) {
          const content =
            (p.text as string) ??
            (p.content as string) ??
            (p.message as string) ??
            null;
          if (content) {
            await supabase.from("msg_log").insert({
              conv_id: convId,
              speaker: agentCode ?? "unknown",
              role: "agent_a",
              content,
              model_used: (p.model as string) ?? null,
              tokens_in: (p.tokensIn as number) ?? 0,
              tokens_out: (p.tokensOut as number) ?? 0,
              cost: (p.cost as number) ?? 0,
              latency_ms: (p.latencyMs as number) ?? null,
            });
          }
        }

        // Log first occurrence of each chat state for discovery
        const stateKey = `chat:${state}`;
        if (!seenEventTypes.has(stateKey)) {
          seenEventTypes.add(stateKey);
          log(`chat state="${state}": ${JSON.stringify(evt).slice(0, 400)}`);
        }
      }
      break;
    }

    // ── cron lifecycle ──────────────────────────────────────────
    case "cron": {
      const action = p.action as string;
      const jobId = p.jobId as string;
      await supabase.from("world_events").insert({
        event_type: `cron_${action}`,
        payload: { jobId, action, runAtMs: Number(p.runAtMs) || 0 },
      });
      log(`cron ${action}: ${jobId.slice(0, 8)}`);
      break;
    }

    // ── ignore silently ─────────────────────────────────────────
    case "health":
    case "tick":
      break;

    default: {
      const preview = JSON.stringify(evt).slice(0, 500);
      if (!seenEventTypes.has(evt.event)) {
        seenEventTypes.add(evt.event);
        log(`NEW event type "${evt.event}": ${preview}`);
      }
    }
  }
}

/**
 * Extracts the agent code from an OpenClaw sessionKey.
 * Format: "agent:<name>:<context>" → returns <name>
 * Falls back to null if the format doesn't match.
 */
function parseAgentFromSessionKey(key: string): string | null {
  const parts = key.split(":");
  if (parts.length >= 2 && parts[0] === "agent") {
    return parts[1] === "main" ? null : parts[1];
  }
  return null;
}

// ───────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────

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
  ws?.close(1000, "shutdown");

  const hardTimeout = setTimeout(() => process.exit(1), 5_000);
  hardTimeout.unref();

  log("shutdown complete");
  process.exit(0);
}

function log(msg: string): void {
  console.log(`[oc-sub] ${msg}`);
}

function warn(msg: string): void {
  console.warn(`[oc-sub] ${msg}`);
}

function error(msg: string): void {
  console.error(`[oc-sub] ${msg}`);
}
