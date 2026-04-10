"use client";
/**
 * GhostInput — Bloque 3 FASE 7
 *
 * UI for Javier to "enter" the pixel world and inject a message
 * into an active conversation. When mounted, emits a `ghost_join`
 * event to world_events (so the pixel world shows a ghost avatar).
 * On unmount or timeout, emits `ghost_leave`.
 *
 * The actual message injection goes through the OpenClaw gateway
 * via the CLI subprocess — for now this is a stub that writes to
 * world_events and logs the intent. Full injection requires the
 * FASE 2 OpenClaw client's `injectGhostMessage` (deferred).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { getBrowserSupabase } from "@/lib/supabase/browser";

interface GhostInputProps {
  sessionId: string;
  agentCode: string;
  onClose: () => void;
}

const GHOST_TIMEOUT_MS = 30_000; // 30s inactivity → auto-leave

export default function GhostInput({
  sessionId,
  agentCode,
  onClose,
}: GhostInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const supabase = getBrowserSupabase();

  // Emit ghost_join on mount
  useEffect(() => {
    supabase.from("world_events").insert({
      event_type: "ghost_join",
      payload: { sessionId, agent: agentCode },
    });

    return () => {
      supabase.from("world_events").insert({
        event_type: "ghost_leave",
        payload: { sessionId },
      });
    };
  }, [sessionId, agentCode, supabase]);

  // Auto-leave after inactivity
  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onClose();
    }, GHOST_TIMEOUT_MS);
  }, [onClose]);

  useEffect(() => {
    resetTimeout();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [resetTimeout]);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    resetTimeout();

    // Write the ghost message to world_events for the pixel world
    await supabase.from("world_events").insert({
      event_type: "ghost_message",
      payload: {
        sessionId,
        agent: agentCode,
        text: message.trim(),
        from: "javier",
      },
    });

    // TODO: inject into OpenClaw conversation via CLI or WS
    // await injectGhostMessage({ sessionId, text: message.trim() });

    setMessage("");
    setSending(false);
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-purple-800 bg-purple-950/50 p-3">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-800 text-xs font-bold text-purple-200">
        J
      </div>
      <span className="text-xs text-purple-400">
        Ghost → {agentCode}
      </span>
      <input
        type="text"
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          resetTimeout();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSend();
          if (e.key === "Escape") onClose();
        }}
        placeholder="Type a message to inject..."
        className="flex-1 rounded bg-purple-900/50 px-2 py-1 text-sm text-purple-100 placeholder-purple-600 outline-none focus:ring-1 focus:ring-purple-500"
        autoFocus
        disabled={sending}
      />
      <button
        onClick={handleSend}
        disabled={sending || !message.trim()}
        className="rounded bg-purple-700 px-3 py-1 text-xs font-medium text-white hover:bg-purple-600 disabled:opacity-50"
      >
        Send
      </button>
      <button
        onClick={onClose}
        className="text-xs text-purple-500 hover:text-purple-400"
      >
        Exit
      </button>
    </div>
  );
}
