"use client";
/**
 * useWorldEvents — Bloque 4 PHASE 1
 *
 * Subscribes to Supabase Realtime on world_events table and
 * dispatches events to the world store.
 */

import { useEffect } from "react";

import { useWorldStore } from "@/store/world-store";
import { useActivityStore } from "@/store/activity-store";
import { useSupabaseRealtime } from "./use-supabase-realtime";

export function useWorldEvents() {
  const {
    startConversation,
    endConversation,
    setAgentState,
    updateConversationSpeech,
    activateGhost,
    deactivateGhost,
  } = useWorldStore();

  const { pushEvent } = useActivityStore();

  useSupabaseRealtime<{
    id: string;
    event_type: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>(
    { table: "world_events", event: "INSERT", channelName: "world-events" },
    ({ new: evt }) => {
      switch (evt.event_type) {
        case "conversation_start": {
          const agent = evt.payload.agent as string | undefined;
          const agentB = evt.payload.agent_b as string | undefined;
          const runId = evt.payload.runId as string;

          if (agent) {
            startConversation({
              id: runId ?? evt.id,
              agentA: agent,
              agentB: agentB ?? null,
              speechText: null,
              speaker: null,
              triggerType:
                (evt.payload.sessionKey as string)?.includes(":cron:")
                  ? "heartbeat"
                  : "manual",
              startedAt: evt.created_at,
              status: "active",
            });

            pushEvent({
              id: evt.id,
              type: "conversation",
              agentA: agent,
              agentB: agentB ?? null,
              summary: "Conversation started",
              cost: 0,
              taskCount: 0,
              timestamp: evt.created_at,
              urgent: false,
            });
          }
          break;
        }

        case "conversation_end": {
          const runId = evt.payload.runId as string;
          if (runId) {
            endConversation(runId);
          }
          break;
        }

        case "agent_move": {
          const from = evt.payload.from as string | undefined;
          const to = evt.payload.to as string | undefined;
          if (from) setAgentState(from, "walking");
          if (to) setAgentState(to, "walking");
          break;
        }

        case "agent_error": {
          const agent = evt.payload.agent as string | undefined;
          const error = evt.payload.error as string | undefined;
          if (agent) {
            setAgentState(agent, "idle");
            pushEvent({
              id: evt.id,
              type: "error",
              agentA: agent,
              agentB: null,
              summary: error ?? "Unknown error",
              cost: 0,
              taskCount: 0,
              timestamp: evt.created_at,
              urgent: true,
            });
          }
          break;
        }

        case "ghost_join": {
          const sessionId = evt.payload.sessionId as string;
          if (sessionId) activateGhost(sessionId);
          break;
        }

        case "ghost_leave": {
          deactivateGhost();
          break;
        }

        case "ghost_message": {
          const convId = evt.payload.sessionId as string;
          const text = evt.payload.text as string;
          if (convId && text) {
            updateConversationSpeech(convId, "javier", text);
          }
          break;
        }

        default: {
          // Cron events and other types
          if (evt.event_type.startsWith("cron_")) {
            pushEvent({
              id: evt.id,
              type: "cron",
              agentA: (evt.payload.jobId as string) ?? "cron",
              agentB: null,
              summary: `Cron ${evt.payload.action ?? evt.event_type}`,
              cost: 0,
              taskCount: 0,
              timestamp: evt.created_at,
              urgent: false,
            });
          }
        }
      }
    },
  );

  // Also subscribe to conv_log changes for speech bubbles
  useSupabaseRealtime<{
    id: string;
    agent_a_code: string | null;
    agent_b_code: string | null;
    status: string;
    summary: string | null;
    total_cost: number;
    started_at: string;
  }>(
    { table: "conv_log", event: "UPDATE", channelName: "conv-updates" },
    ({ new: conv }) => {
      if (conv.summary) {
        // Push updated summary to activity feed
        pushEvent({
          id: conv.id,
          type: "conversation",
          agentA: conv.agent_a_code ?? "unknown",
          agentB: conv.agent_b_code ?? null,
          summary: conv.summary,
          cost: conv.total_cost ?? 0,
          taskCount: 0,
          timestamp: conv.started_at,
          urgent: false,
        });
      }
    },
  );
}

/**
 * Provider component that initializes world events subscription.
 * Mount once at the app level.
 */
export function WorldEventsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const initSprites = useWorldStore((s) => s.initSprites);

  useEffect(() => {
    initSprites();
  }, [initSprites]);

  useWorldEvents();

  return <>{children}</>;
}
