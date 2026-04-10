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
    case "conversation.started": {
      const sessionId = p.sessionId as string;
      const skill = p.skill as string;
      const trigger = (p.trigger as string) ?? "unknown";

      const { data, error: insertErr } = await supabase
        .from("conv_log")
        .insert({
          openclaw_session_id: sessionId,
          agent_a_code: skill,
          trigger_type: trigger,
          status: "active",
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;
      if (data) sessionToConvId.set(sessionId, data.id);

      await supabase.from("world_events").insert({
        event_type: "conversation_start",
        payload: { sessionId, agent: skill },
      });

      await supabase
        .from("agent_positions")
        .update({
          world_state: "talking",
          last_seen_at: new Date().toISOString(),
        })
        .eq("code", skill.toLowerCase());

      log(`conv started: ${skill} [${sessionId.slice(0, 8)}]`);
      break;
    }

    case "conversation.message": {
      const sessionId = p.sessionId as string;
      const convId = await resolveConvId(sessionId);
      if (!convId) {
        warn(`no conv_log for session ${sessionId}, dropping msg`);
        return;
      }

      const tokensIn = (p.tokensIn as number) ?? 0;
      const tokensOut = (p.tokensOut as number) ?? 0;
      const cost = (p.cost as number) ?? 0;

      await supabase.from("msg_log").insert({
        conv_id: convId,
        speaker: p.skill as string,
        role: p.role === "javier" ? "javier" : "agent_a",
        content: p.content as string,
        model_used: (p.model as string) ?? null,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        cost,
        latency_ms: (p.latencyMs as number) ?? null,
      });

      await (supabase.rpc as CallableFunction)("bump_conv_totals", {
        p_conv_id: convId,
        p_tokens: tokensIn + tokensOut,
        p_cost: cost,
      });

      break;
    }

    case "conversation.handoff": {
      await supabase.from("world_events").insert({
        event_type: "agent_move",
        payload: {
          from: String(p.from),
          to: String(p.to),
          sessionId: String(p.sessionId),
        },
      });

      await supabase
        .from("agent_positions")
        .update({
          world_state: "walking",
          last_seen_at: new Date().toISOString(),
        })
        .in("code", [
          (p.from as string).toLowerCase(),
          (p.to as string).toLowerCase(),
        ]);

      log(`handoff: ${p.from} → ${p.to}`);
      break;
    }

    case "conversation.completed": {
      const sessionId = p.sessionId as string;

      await supabase
        .from("conv_log")
        .update({
          status: "completed",
          summary: (p.summary as string) ?? null,
          total_cost: (p.totalCost as number) ?? 0,
          ended_at: new Date().toISOString(),
        })
        .eq("openclaw_session_id", sessionId);

      await supabase.from("world_events").insert({
        event_type: "conversation_end",
        payload: {
          sessionId,
          summary: p.summary ? String(p.summary) : null,
        },
      });

      // Return agent to idle
      const convId = sessionToConvId.get(sessionId);
      if (convId) {
        const { data: conv } = await supabase
          .from("conv_log")
          .select("agent_a_code")
          .eq("id", convId)
          .single();
        if (conv?.agent_a_code) {
          await supabase
            .from("agent_positions")
            .update({
              world_state: "idle",
              last_seen_at: new Date().toISOString(),
            })
            .eq("code", conv.agent_a_code);
        }
      }

      sessionToConvId.delete(sessionId);
      log(`conv completed: [${sessionId.slice(0, 8)}]`);
      break;
    }

    case "agent.error": {
      await supabase.from("world_events").insert({
        event_type: "agent_error",
        payload: {
          skill: String(p.skill),
          error: String(p.error),
          model: p.model ? String(p.model) : null,
        },
      });

      warn(`agent error: ${p.skill} — ${p.error}`);
      break;
    }

    case "health": {
      // Gateway health ping — ignore silently
      break;
    }

    default: {
      log(`unhandled event: ${evt.event}`);
    }
  }
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
