"use client";
/**
 * ConfigPanel — Phase 7
 *
 * Sheet slide-over (right, 480px) triggered by gear icon in Header.
 * Contains: Global Settings, Agent Table, Cron Schedules, Danger Zone.
 */

import { useEffect, useState } from "react";
import { Settings, Download, AlertTriangle } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { AGENT_SPRITES, TIER_COLORS } from "@/lib/sprites/zone-layout";

interface AgentRow {
  code: string;
  world_state: string;
  last_seen_at: string;
}

const CRON_SCHEDULES = [
  { id: "heartbeat-5m", label: "Heartbeat (5 min)", enabled: true },
  { id: "daily-standup", label: "Daily Standup", enabled: true },
  { id: "weekly-review", label: "Weekly Review", enabled: true },
  { id: "cost-audit", label: "Cost Audit (hourly)", enabled: true },
  { id: "task-digest", label: "Task Digest (6h)", enabled: true },
  { id: "code-review", label: "Code Review Sweep", enabled: false },
  { id: "content-pipeline", label: "Content Pipeline", enabled: true },
  { id: "sales-followup", label: "Sales Follow-up", enabled: false },
  { id: "security-scan", label: "Security Scan (daily)", enabled: true },
  { id: "translation-batch", label: "Translation Batch", enabled: false },
  { id: "finance-report", label: "Finance Report", enabled: true },
  { id: "strategy-brief", label: "Strategy Brief", enabled: true },
  { id: "infra-health", label: "Infra Health Check", enabled: true },
];

export default function ConfigPanel() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState("200");
  const [dailyCap, setDailyCap] = useState("10");
  const [maxTurns, setMaxTurns] = useState("4");
  const [cronStates, setCronStates] = useState(() =>
    CRON_SCHEDULES.map((c) => ({ id: c.id, enabled: c.enabled })),
  );

  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabase();
      const { data } = await supabase
        .from("agent_positions")
        .select("code, world_state, last_seen_at")
        .order("code");

      if (data) {
        setAgents(data as AgentRow[]);
      }
    }
    load();
  }, []);

  function toggleCron(id: string) {
    setCronStates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)),
    );
  }

  function handleResetCosts() {
    if (
      window.confirm(
        "Are you sure you want to reset monthly costs? This cannot be undone.",
      )
    ) {
      // Placeholder: would call an API endpoint to reset
      console.log("[ConfigPanel] Reset monthly costs requested");
    }
  }

  function handleExportHistory() {
    // Placeholder: would trigger CSV download
    console.log("[ConfigPanel] Export history requested");
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[480px] p-0 sm:max-w-[480px]">
        <SheetHeader className="border-b border-gray-200 px-4 py-3">
          <SheetTitle className="text-base">Configuration</SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-60px)] overflow-y-auto">
          <div className="space-y-6 p-4">
            {/* Section A: Global Settings */}
            <section>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                Global Settings
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">
                    Monthly Budget
                  </label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      $
                    </span>
                    <Input
                      type="number"
                      value={monthlyBudget}
                      onChange={(e) => setMonthlyBudget(e.target.value)}
                      className="h-8 pl-5 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">
                    Daily Cap
                  </label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      $
                    </span>
                    <Input
                      type="number"
                      value={dailyCap}
                      onChange={(e) => setDailyCap(e.target.value)}
                      className="h-8 pl-5 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">
                    Max Turns/Conv
                  </label>
                  <Input
                    type="number"
                    value={maxTurns}
                    onChange={(e) => setMaxTurns(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </section>

            <Separator />

            {/* Section B: Agent Table */}
            <section>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                Agents ({AGENT_SPRITES.length})
              </h3>
              <div className="rounded-lg border border-gray-200">
                <div className="grid grid-cols-[1fr_60px_80px_80px] gap-1 border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  <span>Code</span>
                  <span>Tier</span>
                  <span>State</span>
                  <span>Last Seen</span>
                </div>
                <div className="max-h-[280px] overflow-y-auto">
                  {AGENT_SPRITES.map((sprite) => {
                    const agentData = agents.find(
                      (a) => a.code === sprite.code,
                    );
                    const tierColor =
                      TIER_COLORS[sprite.tier] ?? TIER_COLORS.FREE;

                    return (
                      <div
                        key={sprite.code}
                        className="grid grid-cols-[1fr_60px_80px_80px] items-center gap-1 border-b border-gray-50 px-3 py-1.5 text-xs last:border-b-0"
                      >
                        <span className="truncate font-medium text-gray-900">
                          {sprite.code}
                        </span>
                        <Badge
                          variant="outline"
                          className="h-4 w-fit px-1 text-[10px]"
                          style={{
                            borderColor: tierColor,
                            color: tierColor,
                          }}
                        >
                          {sprite.tier}
                        </Badge>
                        <span className="text-[10px] text-gray-500">
                          {agentData?.world_state ?? "idle"}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {agentData?.last_seen_at
                            ? new Date(
                                agentData.last_seen_at,
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "\u2014"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <Separator />

            {/* Section C: Cron Schedules */}
            <section>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">
                Cron Schedules
              </h3>
              <div className="space-y-1">
                {CRON_SCHEDULES.map((cron) => {
                  const state = cronStates.find((c) => c.id === cron.id);
                  const isEnabled = state?.enabled ?? cron.enabled;

                  return (
                    <div
                      key={cron.id}
                      className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-gray-50"
                    >
                      <span className="text-xs text-gray-700">
                        {cron.label}
                      </span>
                      <button
                        onClick={() => toggleCron(cron.id)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${
                          isEnabled ? "bg-blue-500" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            isEnabled ? "left-[18px]" : "left-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <Separator />

            {/* Section D: Danger Zone */}
            <section>
              <h3 className="mb-3 text-sm font-semibold text-red-600">
                Danger Zone
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleResetCosts}
                  className="text-xs"
                >
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Reset Monthly Costs
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportHistory}
                  className="text-xs"
                >
                  <Download className="mr-1 h-3 w-3" />
                  Export History
                </Button>
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
