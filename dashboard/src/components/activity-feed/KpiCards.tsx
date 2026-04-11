"use client";
/**
 * KpiCards — Bloque 4 PHASE 3
 *
 * 2x2 grid of KPI cards in the sidebar bottom.
 * Agents, Today cost, Tasks, Errors.
 */

import Link from "next/link";
import { useActivityStore } from "@/store/activity-store";
import { useCostStore } from "@/store/cost-store";

interface KpiCardProps {
  label: string;
  value: string;
  href: string;
  indicator?: "green" | "red" | "yellow" | null;
}

function KpiCard({ label, value, href, indicator }: KpiCardProps) {
  return (
    <Link
      href={href}
      className="flex flex-col rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100"
    >
      <span className="text-xs text-gray-500">{label}</span>
      <span className="flex items-center gap-1.5 font-mono text-lg font-semibold text-gray-900">
        {value}
        {indicator && (
          <span
            className={`h-2 w-2 rounded-full ${
              indicator === "green"
                ? "bg-emerald-500"
                : indicator === "red"
                  ? "bg-red-500"
                  : "bg-yellow-500"
            }`}
          />
        )}
      </span>
    </Link>
  );
}

export default function KpiCards() {
  const kpis = useActivityStore((s) => s.kpis);
  const summary = useCostStore((s) => s.summary);

  return (
    <div className="grid grid-cols-2 gap-2">
      <KpiCard
        label="Agents"
        value={`${kpis.activeCount}/${kpis.agentCount}`}
        href="/"
        indicator={kpis.activeCount > 0 ? "green" : null}
      />
      <KpiCard
        label="Today"
        value={`$${summary.today.toFixed(2)}`}
        href="/costs"
      />
      <KpiCard
        label="Tasks"
        value={`${kpis.openTasks} open`}
        href="/tasks"
      />
      <KpiCard
        label="Errors"
        value={String(kpis.errorCount)}
        href="/comms"
        indicator={kpis.errorCount === 0 ? "green" : "red"}
      />
    </div>
  );
}
