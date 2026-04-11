"use client";

import { useEffect, useMemo, useCallback } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import Link from "next/link";

import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useCostStore, type TimeRange } from "@/store/cost-store";
import { AGENT_SPRITES, TIER_COLORS } from "@/lib/sprites/zone-layout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

// ── Helpers ────────────────────────────────────────────────────────

function getDateRange(range: TimeRange): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);

  switch (range) {
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: d.toISOString().slice(0, 10), to };
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { from: d.toISOString().slice(0, 10), to };
    }
    case "this_month": {
      const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      return { from, to };
    }
    case "last_month": {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        from: d.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      };
    }
    default:
      return { from: to, to };
  }
}

const TIER_MAP = new Map(AGENT_SPRITES.map((a) => [a.code, a.tier]));

const BUDGET = 200;
const DAILY_CAP = 10;

const PERIOD_BUTTONS: { label: string; value: TimeRange }[] = [
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
];

// ── Component ──────────────────────────────────────────────────────

export default function CostDashboard() {
  const {
    dailyCosts,
    timeRange,
    summary,
    loading,
    setDailyCosts,
    setTimeRange,
    setSummary,
    setLoading,
  } = useCostStore();

  const fetchData = useCallback(
    async (range: TimeRange) => {
      setLoading(true);
      try {
        const supabase = getBrowserSupabase();
        const { from, to } = getDateRange(range);

        const { data: rows } = await supabase
          .from("costs_log")
          .select(
            "date, agent_code, model, tokens_in, tokens_out, cost, request_count, error_count"
          )
          .gte("date", from)
          .lte("date", to)
          .order("date", { ascending: true });

        const costs = (rows ?? []).map((r) => ({
          date: r.date as string,
          agentCode: r.agent_code as string,
          model: r.model as string,
          tokensIn: Number(r.tokens_in),
          tokensOut: Number(r.tokens_out),
          cost: Number(r.cost),
          requestCount: Number(r.request_count),
          errorCount: Number(r.error_count),
        }));

        setDailyCosts(costs);

        // Compute summary
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

        // For monthly total, fetch the entire current month
        const { data: monthRows } = await supabase
          .from("costs_log")
          .select("cost, date")
          .gte("date", monthStart)
          .lte("date", todayStr);

        const monthly = (monthRows ?? []).reduce(
          (s, r) => s + Number(r.cost),
          0
        );
        const today = (monthRows ?? [])
          .filter((r) => r.date === todayStr)
          .reduce((s, r) => s + Number(r.cost), 0);

        // Days elapsed this month
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0
        ).getDate();
        const projectedMonthly =
          dayOfMonth > 0 ? (monthly / dayOfMonth) * daysInMonth : 0;

        // Last month total for % change
        const lastMonthStart = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1
        );
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const { data: lastMonthRows } = await supabase
          .from("costs_log")
          .select("cost")
          .gte("date", lastMonthStart.toISOString().slice(0, 10))
          .lte("date", lastMonthEnd.toISOString().slice(0, 10));

        const lastMonthTotal = (lastMonthRows ?? []).reduce(
          (s, r) => s + Number(r.cost),
          0
        );
        const monthlyChange =
          lastMonthTotal > 0
            ? ((monthly - lastMonthTotal) / lastMonthTotal) * 100
            : 0;

        setSummary({
          monthly,
          today,
          budgetUsedPct: BUDGET > 0 ? (monthly / BUDGET) * 100 : 0,
          projectedMonthly,
          monthlyChange,
        });
      } finally {
        setLoading(false);
      }
    },
    [setDailyCosts, setSummary, setLoading]
  );

  useEffect(() => {
    fetchData(timeRange);
  }, [timeRange, fetchData]);

  // Aggregate daily costs for chart
  const dailyChartData = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const c of dailyCosts) {
      byDate.set(c.date, (byDate.get(c.date) ?? 0) + c.cost);
    }
    return [...byDate.entries()]
      .map(([date, cost]) => ({ date, cost: Number(cost.toFixed(4)) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyCosts]);

  // Top spenders
  const topSpenders = useMemo(() => {
    const byAgent = new Map<string, number>();
    for (const c of dailyCosts) {
      byAgent.set(c.agentCode, (byAgent.get(c.agentCode) ?? 0) + c.cost);
    }
    return [...byAgent.entries()]
      .map(([agentCode, total]) => ({
        agentCode,
        total: Number(total.toFixed(4)),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [dailyCosts]);

  // Cost by tier
  const costByTier = useMemo(() => {
    const byTier = new Map<string, number>();
    for (const c of dailyCosts) {
      const tier = TIER_MAP.get(c.agentCode) ?? "FREE";
      byTier.set(tier, (byTier.get(tier) ?? 0) + c.cost);
    }
    return [
      { tier: "LOCAL", total: Number((byTier.get("LOCAL") ?? 0).toFixed(4)), color: TIER_COLORS.LOCAL },
      { tier: "FREE", total: Number((byTier.get("FREE") ?? 0).toFixed(4)), color: TIER_COLORS.FREE },
      { tier: "PAID", total: Number((byTier.get("PAID") ?? 0).toFixed(4)), color: TIER_COLORS.PAID },
      { tier: "PREMIUM", total: Number((byTier.get("PREMIUM") ?? 0).toFixed(4)), color: TIER_COLORS.PREMIUM },
    ];
  }, [dailyCosts]);

  // Cost by division (zone)
  const ZONE_MAP = new Map(
    AGENT_SPRITES.map((a) => [a.code, a.zone])
  );
  const ZONE_NAMES: Record<number, string> = {
    1: "Code Ops",
    2: "Revenue",
    3: "Brand & Content",
    4: "Ops & Finance",
    5: "Product",
    6: "AI Ops",
    7: "Strategy",
    8: "Comms & Lang",
    9: "Workhorse",
  };

  const costByDivision = useMemo(() => {
    const byZone = new Map<number, number>();
    for (const c of dailyCosts) {
      const zone = ZONE_MAP.get(c.agentCode) ?? 0;
      if (zone > 0) {
        byZone.set(zone, (byZone.get(zone) ?? 0) + c.cost);
      }
    }
    return [...byZone.entries()]
      .map(([zone, total]) => ({
        division: ZONE_NAMES[zone] ?? `Zone ${zone}`,
        total: Number(total.toFixed(4)),
      }))
      .sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyCosts]);

  const handleSetTimeRange = (range: TimeRange) => {
    setTimeRange(range);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <header className="mb-6">
        <Link
          href="/"
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          &larr; Back
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Cost Center</h1>
        <p className="text-sm text-gray-500">
          Usage analytics and spend across all agents
        </p>
      </header>

      {/* Period selector */}
      <div className="mb-6 flex items-center gap-2">
        {PERIOD_BUTTONS.map((p) => (
          <Button
            key={p.value}
            variant={timeRange === p.value ? "default" : "outline"}
            size="sm"
            onClick={() => handleSetTimeRange(p.value)}
          >
            {p.label}
          </Button>
        ))}
        {loading && (
          <span className="ml-2 text-xs text-gray-400">Loading...</span>
        )}
      </div>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Monthly total */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Monthly Total</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            ${summary.monthly.toFixed(2)}
          </p>
          <p
            className={`mt-1 text-xs font-medium ${
              summary.monthlyChange >= 0 ? "text-red-500" : "text-green-500"
            }`}
          >
            {summary.monthlyChange >= 0 ? "+" : ""}
            {summary.monthlyChange.toFixed(1)}% vs last month
          </p>
        </div>

        {/* Today */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Today</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            ${summary.today.toFixed(4)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Cap: ${DAILY_CAP}/day
          </p>
        </div>

        {/* Budget gauge */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">
            Budget (${BUDGET})
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {Math.min(summary.budgetUsedPct, 100).toFixed(1)}%
          </p>
          <Progress
            value={Math.min(summary.budgetUsedPct, 100)}
            className="mt-2 h-2"
          />
          <p className="mt-1 text-xs text-gray-400">
            ${summary.monthly.toFixed(2)} / ${BUDGET}
          </p>
        </div>

        {/* Projected monthly */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">
            Projected Monthly
          </p>
          <p
            className={`mt-1 text-2xl font-semibold ${
              summary.projectedMonthly > BUDGET
                ? "text-red-600"
                : "text-gray-900"
            }`}
          >
            ${summary.projectedMonthly.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {summary.projectedMonthly > BUDGET
              ? "Over budget!"
              : "Within budget"}
          </p>
        </div>
      </div>

      {/* Daily cost area chart */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">
          Daily Cost
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#6B7280" }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6B7280" }}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value) => [`$${Number(value).toFixed(4)}`, "Cost"]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <ReferenceLine
                y={DAILY_CAP}
                stroke="#DC2626"
                strokeDasharray="6 4"
                strokeWidth={2}
                label={{
                  value: `$${DAILY_CAP} cap`,
                  position: "insideTopRight",
                  fill: "#DC2626",
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke="#2563EB"
                fill="#2563EB"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom two columns: Top Spenders + Cost by Tier */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top Spenders */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            Top Spenders
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topSpenders}
                layout="vertical"
                margin={{ left: 100 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E5E7EB"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <YAxis
                  dataKey="agentCode"
                  type="category"
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  width={95}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value) => [
                    `$${Number(value).toFixed(4)}`,
                    "Total",
                  ]}
                />
                <Bar
                  dataKey="total"
                  fill="#2563EB"
                  radius={[0, 4, 4, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost by Tier */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            Cost by Tier
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costByTier}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E5E7EB"
                  vertical={false}
                />
                <XAxis
                  dataKey="tier"
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value) => [
                    `$${Number(value).toFixed(4)}`,
                    "Total",
                  ]}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} barSize={48}>
                  {costByTier.map((entry) => (
                    <rect key={entry.tier} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center justify-center gap-4">
            {costByTier.map((entry) => (
              <div key={entry.tier} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-gray-500">{entry.tier}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full-width: Cost by Division */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">
          Cost by Division
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={costByDivision}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E5E7EB"
                vertical={false}
              />
              <XAxis
                dataKey="division"
                tick={{ fontSize: 11, fill: "#6B7280" }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6B7280" }}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value) => [
                  `$${Number(value).toFixed(4)}`,
                  "Total",
                ]}
              />
              <Bar
                dataKey="total"
                fill="#2563EB"
                radius={[4, 4, 0, 0]}
                barSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </main>
  );
}
