"use client";
/**
 * ThreadList — Phase 4
 *
 * Left sidebar listing all 24 agents as chat threads.
 * Shows last message preview, unread count badge, relative timestamp,
 * and a search filter at top.
 */

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AGENT_SPRITES } from "@/lib/sprites/zone-layout";
import { useChatStore } from "@/store/chat-store";

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return `${Math.floor(diffSec / 86400)}d`;
}

export default function ThreadList() {
  const [search, setSearch] = useState("");
  const threads = useChatStore((s) => s.threads);
  const activeThread = useChatStore((s) => s.activeThread);
  const setActiveThread = useChatStore((s) => s.setActiveThread);
  const initThread = useChatStore((s) => s.initThread);

  // Build sorted agent list
  const agents = useMemo(() => {
    const filtered = AGENT_SPRITES.filter((a) =>
      a.code.toLowerCase().includes(search.toLowerCase()),
    );

    // Sort by last message time (threads with messages first)
    return filtered.sort((a, b) => {
      const tA = threads.get(a.code);
      const tB = threads.get(b.code);
      const timeA = tA?.lastMessageAt
        ? new Date(tA.lastMessageAt).getTime()
        : 0;
      const timeB = tB?.lastMessageAt
        ? new Date(tB.lastMessageAt).getTime()
        : 0;
      return timeB - timeA;
    });
  }, [search, threads]);

  function handleSelect(code: string) {
    initThread(code);
    setActiveThread(code);
  }

  return (
    <div className="flex h-full flex-col border-r border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-3">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">
          Agent Chats
        </h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Thread list */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="flex flex-col">
          {agents.map((agent) => {
            const thread = threads.get(agent.code);
            const isActive = activeThread === agent.code;
            const unread = thread?.unreadCount ?? 0;
            const lastMsg = thread?.lastMessage;
            const lastAt = thread?.lastMessageAt;

            return (
              <button
                key={agent.code}
                onClick={() => handleSelect(agent.code)}
                className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                  isActive ? "bg-blue-50" : ""
                }`}
              >
                {/* Tier color dot */}
                <span
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: agent.borderColor }}
                />

                {/* Text content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium text-gray-900">
                      {agent.code}
                    </span>
                    {lastAt && (
                      <span className="ml-1 shrink-0 text-[10px] text-gray-400">
                        {relativeTime(lastAt)}
                      </span>
                    )}
                  </div>
                  {lastMsg && (
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {lastMsg}
                    </p>
                  )}
                </div>

                {/* Unread badge */}
                {unread > 0 && (
                  <Badge className="mt-1 shrink-0 bg-blue-500 text-[10px] text-white">
                    {unread}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
