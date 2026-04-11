/**
 * Activity Store — Bloque 4 PHASE 1
 *
 * Real-time activity feed events and KPI aggregations.
 * Fed by Supabase Realtime on conv_log, world_events, and tasks.
 */

import { create } from "zustand";

import type { ActivityEvent, KpiSnapshot } from "@/types";

const MAX_EVENTS = 100;

interface ActivityState {
  events: ActivityEvent[];
  kpis: KpiSnapshot;
}

interface ActivityActions {
  pushEvent: (event: ActivityEvent) => void;
  setKpis: (kpis: Partial<KpiSnapshot>) => void;
  refreshKpis: (kpis: KpiSnapshot) => void;
  clearEvents: () => void;
}

export const useActivityStore = create<ActivityState & ActivityActions>(
  (set) => ({
    events: [],
    kpis: {
      agentCount: 24,
      activeCount: 0,
      todayCost: 0,
      openTasks: 0,
      errorCount: 0,
    },

    pushEvent: (event) =>
      set((state) => ({
        events: [event, ...state.events].slice(0, MAX_EVENTS),
      })),

    setKpis: (partial) =>
      set((state) => ({
        kpis: { ...state.kpis, ...partial },
      })),

    refreshKpis: (kpis) => set({ kpis }),

    clearEvents: () => set({ events: [] }),
  }),
);
