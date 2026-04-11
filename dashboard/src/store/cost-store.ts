/**
 * Cost Store — Bloque 4 PHASE 1
 *
 * Cost center data: daily aggregations, agent costs,
 * time range selection, and summary KPIs.
 */

import { create } from "zustand";

import type { CostAggregation, CostSummary } from "@/types";

export type TimeRange = "7d" | "30d" | "this_month" | "last_month" | "custom";

interface CostState {
  dailyCosts: CostAggregation[];
  timeRange: TimeRange;
  summary: CostSummary;
  loading: boolean;
}

interface CostActions {
  setDailyCosts: (costs: CostAggregation[]) => void;
  setTimeRange: (range: TimeRange) => void;
  setSummary: (summary: CostSummary) => void;
  setLoading: (loading: boolean) => void;
  getTopSpenders: (limit?: number) => Array<{ agentCode: string; total: number }>;
  getCostByTier: () => Array<{ tier: string; total: number }>;
}

export const useCostStore = create<CostState & CostActions>((set, get) => ({
  dailyCosts: [],
  timeRange: "30d",
  summary: {
    monthly: 0,
    today: 0,
    budgetUsedPct: 0,
    projectedMonthly: 0,
    monthlyChange: 0,
  },
  loading: false,

  setDailyCosts: (costs) => set({ dailyCosts: costs }),
  setTimeRange: (range) => set({ timeRange: range }),
  setSummary: (summary) => set({ summary }),
  setLoading: (loading) => set({ loading }),

  getTopSpenders: (limit = 10) => {
    const { dailyCosts } = get();
    const byAgent = new Map<string, number>();
    for (const c of dailyCosts) {
      byAgent.set(c.agentCode, (byAgent.get(c.agentCode) ?? 0) + c.cost);
    }
    return [...byAgent.entries()]
      .map(([agentCode, total]) => ({ agentCode, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  },

  getCostByTier: () => {
    // Tier mapping will use zone-layout AGENT_SPRITES tier info
    return [];
  },
}));
