"use client";
/**
 * ActivityFeed — Bloque 4
 *
 * Live feed showing agent-to-agent conversations in real-time,
 * like Instagram Live. Shows messages from conv_log and msg_log
 * as they happen. Subscribes to Supabase Realtime.
 */

import { useEffect, useState } from "react";

import { getBrowserSupabase } from "@/lib/supabase/browser";
import { AGENT_SPRITES, TIER_COLORS } from "@/lib/sprites/zone-layout";

interface LiveMessage {
  id: string;
  speaker: string;
  content: string;
  model_used: string | null;
  cost: number;
  created_at: string;
  conv_agent_a: string | null;
  conv_agent_b: string | null;
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return "ahora";
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function getAgentColor(code: string): string {
  const agent = AGENT_SPRITES.find((a) => a.code === code);
  return agent?.borderColor ?? TIER_COLORS.FREE;
}

function AgentBadge({ code }: { code: string }) {
  const color = getAgentColor(code);
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="font-mono text-xs font-bold" style={{ color }}>
        {code}
      </span>
    </span>
  );
}

export default function ActivityFeed() {
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [convos, setConvos] = useState<
    Array<{
      id: string;
      agent_a_code: string | null;
      agent_b_code: string | null;
      status: string;
      summary: string | null;
      total_cost: number;
      started_at: string;
      trigger_type: string | null;
    }>
  >([]);

  // Load recent conversations and messages
  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabase();

      // Load recent conversations
      const { data: convData } = await supabase
        .from("conv_log")
        .select(
          "id, agent_a_code, agent_b_code, status, summary, total_cost, started_at, trigger_type",
        )
        .order("started_at", { ascending: false })
        .limit(20);

      if (convData) setConvos(convData);

      // Load recent messages
      const { data: msgData } = await supabase
        .from("msg_log")
        .select(
          "id, speaker, content, model_used, cost, created_at, conv_id",
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (msgData) {
        const liveMsgs: LiveMessage[] = msgData.map((m) => ({
          id: m.id,
          speaker: m.speaker,
          content: m.content,
          model_used: m.model_used,
          cost: Number(m.cost) || 0,
          created_at: m.created_at,
          conv_agent_a: null,
          conv_agent_b: null,
        }));
        setMessages(liveMsgs);
      }
    }
    load();
  }, []);

  // Subscribe to new messages in real-time
  useEffect(() => {
    const supabase = getBrowserSupabase();

    const msgChannel = supabase
      .channel("live-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "msg_log" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const msg: LiveMessage = {
            id: row.id as string,
            speaker: row.speaker as string,
            content: row.content as string,
            model_used: (row.model_used as string) ?? null,
            cost: Number(row.cost) || 0,
            created_at: row.created_at as string,
            conv_agent_a: null,
            conv_agent_b: null,
          };
          setMessages((prev) => [msg, ...prev].slice(0, 100));
        },
      )
      .subscribe();

    const convChannel = supabase
      .channel("live-convos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conv_log" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (payload.eventType === "INSERT") {
            setConvos((prev) =>
              [
                {
                  id: row.id as string,
                  agent_a_code: (row.agent_a_code as string) ?? null,
                  agent_b_code: (row.agent_b_code as string) ?? null,
                  status: (row.status as string) ?? "active",
                  summary: (row.summary as string) ?? null,
                  total_cost: Number(row.total_cost) || 0,
                  started_at: row.started_at as string,
                  trigger_type: (row.trigger_type as string) ?? null,
                },
                ...prev,
              ].slice(0, 20),
            );
          } else if (payload.eventType === "UPDATE") {
            setConvos((prev) =>
              prev.map((c) =>
                c.id === (row.id as string)
                  ? {
                      ...c,
                      status: (row.status as string) ?? c.status,
                      summary: (row.summary as string) ?? c.summary,
                      total_cost: Number(row.total_cost) || c.total_cost,
                    }
                  : c,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(convChannel);
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Live Feed
        </h3>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span className="text-[10px] font-bold text-red-500">LIVE</span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Active conversations */}
        {convos.filter((c) => c.status === "active").length > 0 && (
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="mb-1 text-[10px] font-bold uppercase text-emerald-500">
              Hablando ahora
            </p>
            {convos
              .filter((c) => c.status === "active")
              .map((c) => (
                <div
                  key={c.id}
                  className="mb-1 flex items-center gap-2 rounded-md bg-emerald-50 px-2 py-1"
                >
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  <AgentBadge code={c.agent_a_code ?? "unknown"} />
                  {c.agent_b_code && (
                    <>
                      <span className="text-xs text-gray-400">↔</span>
                      <AgentBadge code={c.agent_b_code} />
                    </>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* Recent conversations */}
        {convos.length > 0 && (
          <div className="divide-y divide-gray-50">
            {convos.map((c) => (
              <div
                key={c.id}
                className="px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        c.status === "active"
                          ? "bg-emerald-500 animate-pulse"
                          : c.status === "completed"
                            ? "bg-gray-300"
                            : "bg-red-400"
                      }`}
                    />
                    <AgentBadge code={c.agent_a_code ?? "?"} />
                    {c.agent_b_code && (
                      <>
                        <span className="text-[10px] text-gray-300">→</span>
                        <AgentBadge code={c.agent_b_code} />
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {c.total_cost > 0 && (
                      <span className="font-mono text-[10px] text-gray-400">
                        ${Number(c.total_cost).toFixed(4)}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">
                      {timeAgo(c.started_at)}
                    </span>
                  </div>
                </div>
                {c.summary && (
                  <p className="mt-0.5 truncate pl-4 text-xs text-gray-500">
                    {c.summary}
                  </p>
                )}
                {c.trigger_type && (
                  <span className="ml-4 mt-0.5 inline-block rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-400">
                    {c.trigger_type}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Live messages */}
        {messages.length > 0 && (
          <div className="border-t border-gray-100">
            <p className="px-3 py-1 text-[10px] font-bold uppercase text-gray-400">
              Mensajes recientes
            </p>
            <div className="divide-y divide-gray-50">
              {messages.slice(0, 30).map((msg) => (
                <div key={msg.id} className="px-3 py-1.5">
                  <div className="flex items-center justify-between">
                    <AgentBadge code={msg.speaker} />
                    <span className="text-[10px] text-gray-400">
                      {timeAgo(msg.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">
                    {msg.content}
                  </p>
                  {msg.model_used && (
                    <span className="mt-0.5 inline-block rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-400">
                      {msg.model_used.split("/").pop()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {convos.length === 0 && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center p-4">
            <p className="text-center text-xs text-gray-400">
              Sin actividad aun. Los agents empezaran a hablar cuando los crons se disparen.
            </p>
            <p className="mt-1 text-center text-[10px] text-gray-300">
              Asegurate de tener npm run subscribe corriendo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
