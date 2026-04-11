"use client";
/**
 * ConvDetail — Phase 7
 *
 * Detail view for a selected conversation. Shows all messages
 * from msg_log, cost/token summary, and related tasks.
 */

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getBrowserSupabase } from "@/lib/supabase/browser";

interface MsgRow {
  id: string;
  conv_id: string;
  speaker: string;
  role: string;
  content: string;
  model_used: string | null;
  tokens_in: number;
  tokens_out: number;
  cost: number;
  latency_ms: number | null;
  created_at: string;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigned_to_code: string | null;
}

interface ConvSummary {
  agent_a_code: string | null;
  agent_b_code: string | null;
  status: string;
  trigger_type: string | null;
  summary: string | null;
  total_tokens: number;
  total_cost: number;
  started_at: string;
  ended_at: string | null;
}

interface ConvDetailProps {
  convId: string;
  conv: ConvSummary;
}

export default function ConvDetail({ convId, conv }: ConvDetailProps) {
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const supabase = getBrowserSupabase();

      const [msgRes, taskRes] = await Promise.all([
        supabase
          .from("msg_log")
          .select("*")
          .eq("conv_id", convId)
          .order("created_at", { ascending: true }),
        supabase
          .from("tasks")
          .select("id, title, status, priority, assigned_to_code")
          .eq("conv_id", convId),
      ]);

      if (!cancelled) {
        setMessages((msgRes.data as MsgRow[]) ?? []);
        setTasks((taskRes.data as TaskRow[]) ?? []);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [convId]);

  // Compute aggregates
  const totalTokens = messages.reduce(
    (sum, m) => sum + m.tokens_in + m.tokens_out,
    0,
  );
  const totalCost = messages.reduce((sum, m) => sum + Number(m.cost), 0);
  const duration =
    conv.started_at && conv.ended_at
      ? Math.round(
          (new Date(conv.ended_at).getTime() -
            new Date(conv.started_at).getTime()) /
            1000,
        )
      : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              conv.status === "completed"
                ? "bg-green-500"
                : conv.status === "active"
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
          />
          <h3 className="text-sm font-semibold text-gray-900">
            {conv.agent_a_code ?? "unknown"}
            {conv.agent_b_code ? ` \u2192 ${conv.agent_b_code}` : ""}
          </h3>
          {conv.trigger_type && (
            <Badge variant="secondary" className="text-[10px]">
              {conv.trigger_type}
            </Badge>
          )}
        </div>
        {conv.summary && (
          <p className="mt-1 text-xs text-gray-500">{conv.summary}</p>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="space-y-3 p-4">
          {loading && (
            <p className="py-8 text-center text-sm text-gray-400">
              Loading messages...
            </p>
          )}

          {!loading && messages.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">
              No messages found for this conversation.
            </p>
          )}

          {messages.map((msg) => {
            const isGhost = msg.role === "javier";
            return (
              <div
                key={msg.id}
                className={`rounded-lg border border-gray-100 p-3 ${
                  isGhost ? "bg-blue-50" : "bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    {msg.speaker}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>

                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                  {msg.content}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {msg.model_used && (
                    <Badge variant="outline" className="text-[10px]">
                      {msg.model_used}
                    </Badge>
                  )}
                  <span className="font-mono text-[10px] text-gray-400">
                    {msg.tokens_in + msg.tokens_out} tok
                  </span>
                  {Number(msg.cost) > 0 && (
                    <span className="font-mono text-[10px] text-gray-400">
                      ${Number(msg.cost).toFixed(4)}
                    </span>
                  )}
                  {msg.latency_ms != null && (
                    <span className="font-mono text-[10px] text-gray-400">
                      {msg.latency_ms}ms
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary footer */}
        {!loading && messages.length > 0 && (
          <div className="border-t border-gray-200 p-4">
            <Separator className="mb-3" />
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Summary
            </h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="font-mono text-sm font-semibold text-gray-900">
                  ${totalCost.toFixed(4)}
                </p>
                <p className="text-[10px] text-gray-500">Total Cost</p>
              </div>
              <div>
                <p className="font-mono text-sm font-semibold text-gray-900">
                  {totalTokens.toLocaleString()}
                </p>
                <p className="text-[10px] text-gray-500">Total Tokens</p>
              </div>
              <div>
                <p className="font-mono text-sm font-semibold text-gray-900">
                  {duration != null ? `${duration}s` : "\u2014"}
                </p>
                <p className="text-[10px] text-gray-500">Duration</p>
              </div>
            </div>

            {/* Related tasks */}
            {tasks.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Tasks Generated
                </h4>
                <div className="space-y-1">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 rounded border border-gray-100 bg-gray-50 px-2 py-1.5"
                    >
                      <span
                        className={`text-xs font-bold ${
                          task.priority === "P0"
                            ? "text-red-500"
                            : task.priority === "P1"
                              ? "text-orange-500"
                              : task.priority === "P2"
                                ? "text-yellow-500"
                                : "text-green-500"
                        }`}
                      >
                        {task.priority}
                      </span>
                      <span className="flex-1 truncate text-xs text-gray-700">
                        {task.title}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {task.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
