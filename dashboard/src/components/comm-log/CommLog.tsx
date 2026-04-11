"use client";
/**
 * CommLog — Phase 7
 *
 * Master-detail layout for the comm log page. Left panel shows
 * conversations from conv_log with search/filter controls.
 * Right panel shows ConvDetail with messages from msg_log.
 */

import { useEffect, useMemo, useState } from "react";
import { Search, MessageSquare } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getBrowserSupabase } from "@/lib/supabase/browser";

import ConvDetail from "./ConvDetail";

interface ConvRow {
  id: string;
  openclaw_session_id: string | null;
  agent_a_code: string | null;
  agent_b_code: string | null;
  trigger_type: string | null;
  trigger_context: string | null;
  status: string;
  total_tokens: number;
  total_cost: number;
  summary: string | null;
  started_at: string;
  ended_at: string | null;
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export default function CommLog() {
  const [convos, setConvos] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [triggerFilter, setTriggerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Load conversations
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const supabase = getBrowserSupabase();
      const { data, error } = await supabase
        .from("conv_log")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("[CommLog] Load error:", error);
      }

      if (!cancelled) {
        setConvos((data as ConvRow[]) ?? []);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered conversations
  const filtered = useMemo(() => {
    return convos.filter((c) => {
      // Text search
      if (searchText) {
        const q = searchText.toLowerCase();
        const matches =
          (c.agent_a_code ?? "").toLowerCase().includes(q) ||
          (c.agent_b_code ?? "").toLowerCase().includes(q) ||
          (c.summary ?? "").toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Trigger type filter
      if (triggerFilter !== "all" && c.trigger_type !== triggerFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== "all" && c.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [convos, searchText, triggerFilter, statusFilter]);

  const selectedConv = convos.find((c) => c.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left panel: conversation list */}
      <div className="flex w-[380px] shrink-0 flex-col border-r border-gray-200 bg-white">
        {/* Filter bar */}
        <div className="space-y-2 border-b border-gray-200 p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search agents or summaries..."
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Select value={triggerFilter} onValueChange={setTriggerFilter}>
              <SelectTrigger size="sm" className="h-7 flex-1 text-xs">
                <SelectValue placeholder="Trigger" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All triggers</SelectItem>
                <SelectItem value="heartbeat">Heartbeat</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="ghost">Ghost</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger size="sm" className="h-7 flex-1 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="interrupted">Interrupted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="flex flex-col">
            {loading && (
              <p className="py-12 text-center text-sm text-gray-400">
                Loading conversations...
              </p>
            )}

            {!loading && filtered.length === 0 && (
              <p className="py-12 text-center text-sm text-gray-400">
                No conversations found.
              </p>
            )}

            {filtered.map((c) => {
              const isSelected = selectedId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full border-b border-gray-100 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                    isSelected ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {/* Status dot */}
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        c.status === "completed"
                          ? "bg-green-500"
                          : c.status === "active"
                            ? "bg-yellow-500 animate-pulse"
                            : "bg-red-500"
                      }`}
                    />
                    {/* Agent names */}
                    <span className="truncate text-sm font-medium text-gray-900">
                      {c.agent_a_code ?? "unknown"}
                      {c.agent_b_code ? ` \u2192 ${c.agent_b_code}` : ""}
                    </span>
                    {/* Timestamp */}
                    <span className="ml-auto shrink-0 text-[10px] text-gray-400">
                      {relativeTime(c.started_at)}
                    </span>
                  </div>

                  {/* Summary */}
                  {c.summary && (
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {c.summary}
                    </p>
                  )}

                  {/* Bottom row: cost, trigger */}
                  <div className="mt-1 flex items-center gap-2">
                    {Number(c.total_cost) > 0 && (
                      <span className="font-mono text-[10px] text-gray-400">
                        ${Number(c.total_cost).toFixed(4)}
                      </span>
                    )}
                    {c.trigger_type && (
                      <Badge
                        variant="secondary"
                        className="h-4 px-1 text-[10px]"
                      >
                        {c.trigger_type}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Right panel: detail or placeholder */}
      <div className="flex-1 bg-gray-50">
        {selectedConv ? (
          <ConvDetail convId={selectedConv.id} conv={selectedConv} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-400">
            <MessageSquare className="h-12 w-12" />
            <p className="text-sm">Select a conversation to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
