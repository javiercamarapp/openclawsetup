"use client";
/**
 * MessageView — Phase 4
 *
 * WhatsApp-style message bubbles for a single chat thread.
 * Loads messages from Supabase on mount, subscribes to Realtime
 * for live updates, and auto-scrolls to the latest message.
 */

import { useEffect, useRef } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { AGENT_SPRITES } from "@/lib/sprites/zone-layout";
import { useChatStore } from "@/store/chat-store";
import type { DirectMessage } from "@/types";

import ChatInput from "./ChatInput";

interface MessageViewProps {
  threadId: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MessageView({ threadId }: MessageViewProps) {
  const messages = useChatStore(
    (s) => s.threads.get(threadId)?.messages ?? [],
  );
  const setThreadMessages = useChatStore((s) => s.setThreadMessages);
  const addMessage = useChatStore((s) => s.addMessage);
  const setLoading = useChatStore((s) => s.setLoading);
  const loading = useChatStore((s) => s.loading);

  const bottomRef = useRef<HTMLDivElement>(null);

  const agent = AGENT_SPRITES.find((a) => a.code === threadId);
  const agentLabel = agent?.label ?? threadId;

  // Load messages on mount / thread change
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const supabase = getBrowserSupabase();
        const { data, error } = await supabase
          .from("direct_messages")
          .select("*")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true })
          .limit(200);

        if (error) {
          console.error("[MessageView] Load error:", error);
          return;
        }

        if (!cancelled && data) {
          const msgs: DirectMessage[] = data.map((row) => ({
            id: row.id,
            thread_id: row.thread_id,
            sender: row.sender,
            content: row.content,
            metadata:
              typeof row.metadata === "object" && row.metadata !== null
                ? (row.metadata as Record<string, unknown>)
                : {},
            created_at: row.created_at,
          }));
          setThreadMessages(threadId, msgs);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [threadId, setThreadMessages, setLoading]);

  // Subscribe to Realtime
  useEffect(() => {
    const supabase = getBrowserSupabase();

    const channel = supabase
      .channel(`dm-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const msg: DirectMessage = {
            id: row.id as string,
            thread_id: row.thread_id as string,
            sender: row.sender as string,
            content: row.content as string,
            metadata:
              typeof row.metadata === "object" && row.metadata !== null
                ? (row.metadata as Record<string, unknown>)
                : {},
            created_at: row.created_at as string,
          };
          addMessage(msg);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, addMessage]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex h-full flex-col">
      {/* Thread header */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <span
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: agent?.borderColor ?? "#6B7280" }}
        />
        <h2 className="text-sm font-semibold text-gray-900">{agentLabel}</h2>
        {agent && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
            {agent.tier}
          </span>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 p-4">
          {loading && messages.length === 0 && (
            <p className="py-12 text-center text-sm text-gray-400">
              Loading messages...
            </p>
          )}

          {!loading && messages.length === 0 && (
            <p className="py-12 text-center text-sm text-gray-400">
              No messages yet. Start the conversation!
            </p>
          )}

          {messages.map((msg) => {
            const isJavier = msg.sender === "javier";
            const isSystem = msg.sender === "system";
            const isError = isSystem && msg.metadata?.isError;

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <p
                    className={`rounded px-3 py-1 text-xs ${
                      isError
                        ? "bg-red-50 text-red-600"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {msg.content}
                  </p>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex ${isJavier ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-3 py-2 ${
                    isJavier
                      ? "rounded-l-xl rounded-tr-xl bg-blue-500 text-white"
                      : "rounded-r-xl rounded-tl-xl bg-gray-100 text-gray-900"
                  }`}
                >
                  {!isJavier && (
                    <p className="mb-0.5 text-xs font-semibold text-gray-500">
                      {msg.sender}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  <p
                    className={`mt-1 text-right text-[10px] ${
                      isJavier ? "text-blue-100" : "text-gray-400"
                    }`}
                  >
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <ChatInput threadId={threadId} />
    </div>
  );
}
