import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function CostsPage() {
  const supabase = getServerSupabase();

  const { data: costs } = await supabase
    .from("costs_log")
    .select("agent_code, model, tokens_in, tokens_out, cost, request_count, error_count, date")
    .order("date", { ascending: false })
    .limit(100);

  const totalCost = (costs ?? []).reduce((sum, c) => sum + Number(c.cost), 0);
  const totalRequests = (costs ?? []).reduce(
    (sum, c) => sum + c.request_count,
    0,
  );
  const totalErrors = (costs ?? []).reduce(
    (sum, c) => sum + c.error_count,
    0,
  );

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <header className="mb-6">
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-400">
          &larr; Back
        </Link>
        <h1 className="text-xl font-semibold">Cost Center</h1>
        <p className="text-sm text-slate-500">
          Usage and spend across all agents
        </p>
      </header>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <SummaryCard
          label="Total Spend"
          value={`$${totalCost.toFixed(4)}`}
          sub="all time"
        />
        <SummaryCard
          label="Requests"
          value={totalRequests.toLocaleString()}
          sub="all time"
        />
        <SummaryCard
          label="Errors"
          value={totalErrors.toLocaleString()}
          sub={`${totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(1) : 0}% error rate`}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Model</th>
              <th className="px-3 py-2 text-right">Tokens</th>
              <th className="px-3 py-2 text-right">Cost</th>
              <th className="px-3 py-2 text-right">Reqs</th>
              <th className="px-3 py-2 text-right">Errors</th>
            </tr>
          </thead>
          <tbody>
            {(costs ?? []).length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-slate-600"
                >
                  No cost data yet — the subscriber will populate this
                  as agents run.
                </td>
              </tr>
            )}
            {(costs ?? []).map((c, i) => (
              <tr
                key={`${c.agent_code}-${c.date}-${i}`}
                className="border-t border-slate-800"
              >
                <td className="px-3 py-2 text-slate-400">{c.date}</td>
                <td className="px-3 py-2 font-mono">{c.agent_code}</td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {c.model}
                </td>
                <td className="px-3 py-2 text-right">
                  {(c.tokens_in + c.tokens_out).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right">
                  ${Number(c.cost).toFixed(4)}
                </td>
                <td className="px-3 py-2 text-right">{c.request_count}</td>
                <td className="px-3 py-2 text-right">
                  {c.error_count > 0 ? (
                    <span className="text-red-400">{c.error_count}</span>
                  ) : (
                    c.error_count
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-slate-600">{sub}</p>
    </div>
  );
}
