"use client";
/**
 * AgentBar — Bloque 4 PHASE 3
 *
 * Horizontal scrollable chip strip showing all 24 agents
 * with status indicators. Click to select agent.
 */

import { useWorldStore } from "@/store/world-store";
import type { AgentState } from "@/types";

const STATE_DOTS: Record<AgentState, string> = {
  idle: "bg-emerald-500",
  walking: "bg-yellow-500",
  talking: "bg-blue-500",
  active: "bg-purple-500",
};

export default function AgentBar() {
  const sprites = useWorldStore((s) => s.sprites);
  const selectedAgent = useWorldStore((s) => s.selectedAgent);
  const selectAgent = useWorldStore((s) => s.selectAgent);

  const agents = [...sprites.values()];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 scrollbar-thin">
      {agents.map((agent) => (
        <button
          key={agent.code}
          onClick={() =>
            selectAgent(
              selectedAgent === agent.code ? null : agent.code,
            )
          }
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            selectedAgent === agent.code
              ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
          title={`${agent.label} (${agent.worldState})`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${STATE_DOTS[agent.worldState]}`}
          />
          <span className="max-w-[80px] truncate">{agent.label}</span>
        </button>
      ))}
      {agents.length === 0 && (
        <span className="text-xs text-gray-400">Loading agents...</span>
      )}
    </div>
  );
}
