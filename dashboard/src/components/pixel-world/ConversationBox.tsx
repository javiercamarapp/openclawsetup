"use client";
/**
 * ConversationBox — Bloque 4 PHASE 3
 *
 * Collapsible panel below the pixel world canvas showing
 * the active conversation messages, or the last conversation
 * at 50% opacity when none is active.
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, MessageCircle } from "lucide-react";

import { useWorldStore } from "@/store/world-store";

export default function ConversationBox() {
  const [collapsed, setCollapsed] = useState(false);
  const conversations = useWorldStore((s) => s.conversations);

  const activeConv = conversations.find((c) => c.status === "active");
  const hasContent = !!activeConv;

  return (
    <div
      className={`rounded-lg border ${
        hasContent
          ? "border-gray-200 bg-white"
          : "border-gray-100 bg-gray-50/50"
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-3.5 w-3.5 text-gray-400" />
          {activeConv ? (
            <span className="text-sm font-medium text-gray-800">
              {activeConv.agentA}
              {activeConv.agentB ? ` ↔ ${activeConv.agentB}` : ""}
            </span>
          ) : (
            <span className="text-sm text-gray-400">
              No active conversation
            </span>
          )}
          {activeConv && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
              {activeConv.triggerType}
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {!collapsed && (
        <div
          className={`border-t border-gray-100 px-3 py-2 ${
            !hasContent ? "opacity-50" : ""
          }`}
        >
          {activeConv?.speechText ? (
            <div className="space-y-1">
              <p className="text-sm text-gray-700">
                <span className="font-mono text-xs font-bold text-blue-600">
                  {activeConv.speaker ?? activeConv.agentA}:
                </span>{" "}
                {activeConv.speechText}
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">
              Waiting for conversation data...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
