import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function ConfigPage() {
  const supabase = getServerSupabase();
  const { data: agents } = await supabase
    .from("agent_positions")
    .select("code, division, world_state, world_x, world_y, last_seen_at")
    .order("code");

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <header className="mb-6">
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-400">
          &larr; Back
        </Link>
        <h1 className="text-xl font-semibold">Config</h1>
        <p className="text-sm text-slate-500">
          Agent roster — read-only view from Supabase cache
        </p>
      </header>

      <div className="overflow-x-auto rounded border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2">Division</th>
              <th className="px-3 py-2">Position</th>
              <th className="px-3 py-2">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {(agents ?? []).map((a) => (
              <tr
                key={a.code}
                className="border-t border-slate-800"
              >
                <td className="px-3 py-2 font-mono">{a.code}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
                      a.world_state === "talking"
                        ? "bg-emerald-900 text-emerald-400"
                        : a.world_state === "walking"
                          ? "bg-amber-900 text-amber-400"
                          : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {a.world_state}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-400">
                  {a.division ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  ({Number(a.world_x).toFixed(0)},{" "}
                  {Number(a.world_y).toFixed(0)})
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {new Date(a.last_seen_at).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-sm font-semibold text-slate-400">
          Note
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          This page is read-only. To edit agent configurations, modify{" "}
          <code className="font-mono">config/personas-to-agents.json</code>{" "}
          in the repo and re-deploy. To edit heartbeats, use{" "}
          <code className="font-mono">openclaw cron</code> CLI directly.
        </p>
      </div>
    </main>
  );
}
