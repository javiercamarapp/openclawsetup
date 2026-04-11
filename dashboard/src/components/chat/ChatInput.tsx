"use client";
/**
 * ChatInput — Phase 4
 *
 * Textarea with Send button for composing direct messages.
 * Enter sends, Shift+Enter adds newline. Inserts via API route
 * and optimistically updates the chat store.
 */

import { useRef, useState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
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

    // Optimistic message
    const optimistic: DirectMessage = {
      id: crypto.randomUUID(),
      thread_id: threadId,
      sender: "javier",
      content: trimmed,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    addMessage(optimistic);
    setValue("");

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, content: trimmed }),
      });

      if (!res.ok) {
        console.error("[ChatInput] Send failed:", await res.text());
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
        placeholder="Type a message..."
        disabled={sending}
        rows={1}
        className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
      />
      <Button
        size="icon-sm"
        onClick={handleSend}
        disabled={sending || !value.trim()}
        title="Send message"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
