"use client";
/**
 * Header — Bloque 4 PHASE 1
 *
 * 56px fixed header bar with logo, tabs, status indicators,
 * and cost display. Hybrid theme: light mode exterior.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Globe,
  ListTodo,
  DollarSign,
  MessageSquare,
  MessagesSquare,
} from "lucide-react";

import { useActivityStore } from "@/store/activity-store";
import { useCostStore } from "@/store/cost-store";
import { useTaskStore } from "@/store/task-store";
import ConfigPanel from "./ConfigPanel";

const TABS = [
  { href: "/", label: "World", icon: Globe },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/costs", label: "Costs", icon: DollarSign },
  { href: "/comms", label: "Log", icon: MessageSquare },
  { href: "/chat", label: "Chat", icon: MessagesSquare },
] as const;

export default function Header() {
  const pathname = usePathname();
  const kpis = useActivityStore((s) => s.kpis);
  const summary = useCostStore((s) => s.summary);
  const tasks = useTaskStore((s) => s.tasks);

  const pendingTasks = tasks.filter(
    (t) => t.assigned_to_javier && t.status !== "completed",
  ).length;

  const isOnline = kpis.activeCount > 0 || kpis.agentCount > 0;

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
      {/* Left: Logo + Title */}
      <div className="flex items-center gap-3">
        <span className="text-2xl" role="img" aria-label="OpenClaw">
          🦞
        </span>
        <h1 className="text-base font-semibold text-gray-900">
          Agent Command Center
        </h1>
      </div>

      {/* Center: Tabs */}
      <nav className="flex items-center gap-1">
        {TABS.map((tab) => {
          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Right: Status indicators */}
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <span
          className={`h-2 w-2 rounded-full ${
            isOnline
              ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
              : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]"
          }`}
          title={isOnline ? "Online" : "Offline"}
        />

        {/* Today cost */}
        <span className="font-mono text-sm text-gray-600">
          ${summary.today.toFixed(2)}
        </span>

        {/* Pending tasks badge */}
        {pendingTasks > 0 && (
          <Link
            href="/tasks"
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white"
          >
            {pendingTasks}
          </Link>
        )}

        {/* Agent count */}
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          {kpis.agentCount} agents
        </span>

        {/* Config gear */}
        <ConfigPanel />
      </div>
    </header>
  );
}
