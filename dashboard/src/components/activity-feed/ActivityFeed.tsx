"use client";
/**
 * ActivityFeed — Bloque 4 PHASE 3
 *
 * Scrollable real-time activity stream in the sidebar.
 * Shows conversations, tasks, errors, cron events.
 */

import { useActivityStore } from "@/store/activity-store";
import type { ActivityEvent } from "@/types";

const DOT_COLORS: Record<string, string> = {
  conversation: "bg-emerald-500",
  task: "bg-yellow-500",
  error: "bg-red-500",
  cron: "bg-gray-400",
  info: "bg-gray-400",
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ActivityItem({ event }: { event: ActivityEvent }) {
  return (
    <div className="flex gap-2 px-3 py-2 hover:bg-gray-50 transition-colors cursor-pointer">
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT_COLORS[event.type] ?? "bg-gray-400"}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">{timeAgo(event.timestamp)}</span>
          <span className="truncate text-sm font-medium text-gray-800">
            {event.agentA}
            {event.agentB ? ` → ${event.agentB}` : ""}
          </span>
        </div>
        <p className="truncate text-xs text-gray-500">{event.summary}</p>
      </div>
      {event.cost > 0 && (
        <span className="shrink-0 self-center font-mono text-xs text-gray-400">
          ${event.cost.toFixed(4)}
        </span>
      )}
    </div>
  );
}

export default function ActivityFeed() {
  const events = useActivityStore((s) => s.events);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Activity Feed
        </h3>
        <span className="text-xs text-gray-400">{events.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4">
            <p className="text-center text-xs text-gray-400">
              No activity yet. Leave the subscriber running and trigger a cron.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {events.map((event) => (
              <ActivityItem key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
