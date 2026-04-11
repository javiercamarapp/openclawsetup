"use client";
/**
 * ConversationBox — Bloque 4
 *
 * Fixed-height panel below the pixel world canvas.
 * Shows active conversation or last messages from msg_log.
 * Ghost mode input for Javier to inject into conversations.
 */

import { useEffect, useState } from "react";

import { getBrowserSupabase } from "@/lib/supabase/browser";
import { AGENT_SPRITES } from "@/lib/sprites/zone-layout";

interface RecentMsg {
  id: string;
  speaker: string;
  content: string;
  cost: number;
  created_at: string;
  conv_agent_a: string | null;
}

function getAgentColor(code: string): string {
  const agent = AGENT_SPRITES.find((a) => a.code === code);
  return agent?.borderColor ?? "#6B7280";
}

export default function ConversationBox() {
  const [messages, setMessages] = useState<RecentMsg[]>([]);

  // Load last 5 messages from msg_log
  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabase();
      const { data } = await supabase
        .from("msg_log")
        .select("id, speaker, content, cost, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (data) {
        setMessages(
          data.map((m) => ({
            id: m.id,
            speaker: m.speaker,
            content: m.content,
            cost: Number(m.cost) || 0,
            created_at: m.created_at,
            conv_agent_a: null,
          })),
        );
      }
    }
    load();
  }, []);

  // Subscribe to new messages
  useEffect(() => {
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel("conv-box-msgs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "msg_log" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setMessages((prev) =>
            [
              {
                id: row.id as string,
                speaker: row.speaker as string,
                content: row.content as string,
                cost: Number(row.cost) || 0,
                created_at: row.created_at as string,
                conv_agent_a: null,
              },
              ...prev,
            ].slice(0, 5),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="h-28 overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-1">
        <span className="text-[10px] font-bold uppercase text-gray-400">
          Ultimas conversaciones
        </span>
        <span className="text-[10px] text-gray-300">
          {messages.length} msgs
        </span>
      </div>
      <div className="h-[calc(100%-24px)] overflow-y-auto px-3 py-1">
        {messages.length === 0 ? (
          <p className="py-2 text-center text-xs text-gray-400 italic">
            Sin conversaciones aun...
          </p>
        ) : (
          <div className="space-y-1">
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2">
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: getAgentColor(msg.speaker) }}
                />
                <div className="min-w-0 flex-1">
                  <span
                    className="font-mono text-[10px] font-bold"
                    style={{ color: getAgentColor(msg.speaker) }}
                  >
                    {msg.speaker}:
                  </span>{" "}
                  <span className="text-xs text-gray-600 line-clamp-1">
                    {msg.content}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
