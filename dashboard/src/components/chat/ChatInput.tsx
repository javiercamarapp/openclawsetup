"use client";
/**
 * ChatInput — Phase 4
 *
 * Sends message via API route which:
 * 1. Saves to Supabase
 * 2. Calls OpenRouter with the agent's real model
 * 3. Saves the agent's real AI response
 *
 * Supabase Realtime in MessageView picks up both messages automatically.
 */

import { useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";

import { useChatStore } from "@/store/chat-store";
import type { DirectMessage } from "@/types";

interface ChatInputProps {
  threadId: string;
}

export default function ChatInput({ threadId }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addMessage = useChatStore((s) => s.addMessage);

  async function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setValue("");

    // Optimistic: show Javier's message immediately
    addMessage({
      id: crypto.randomUUID(),
      thread_id: threadId,
      sender: "javier",
      content: trimmed,
      metadata: {},
      created_at: new Date().toISOString(),
    });

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, content: trimmed }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("[ChatInput] Send failed:", errText);
      }
    } catch (err) {
      console.error("[ChatInput] Network error:", err);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-gray-200 bg-white p-3">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribe un mensaje..."
        disabled={sending}
        rows={1}
        className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={sending || !value.trim()}
        title="Enviar mensaje"
        className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
