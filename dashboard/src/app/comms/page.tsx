import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function CommsPage() {
  const supabase = getServerSupabase();
  const { data: convos } = await supabase
    .from("conv_log")
    .select(
      "id, openclaw_session_id, agent_a_code, agent_b_code, status, trigger_type, total_tokens, total_cost, summary, started_at, ended_at",
    )
    .order("started_at", { ascending: false })
    .limit(50);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <header className="mb-6">
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-400">
          &larr; Back
        </Link>
        <h1 className="text-xl font-semibold">Comm Log</h1>
        <p className="text-sm text-slate-500">
          Recent conversations from the OpenClaw gateway
        </p>
      </header>

      <div className="space-y-3">
        {(convos ?? []).length === 0 && (
          <p className="rounded border border-dashed border-slate-800 p-8 text-center text-slate-600">
            No conversations yet — leave the subscriber running and
            trigger a cron to see data here.
          </p>
        )}
        {(convos ?? []).map((c) => (
          <div
            key={c.id}
            className="rounded border border-slate-800 bg-slate-900 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`h-2 w-2 rounded-full ${
                    c.status === "active"
                      ? "bg-emerald-400 animate-pulse"
                      : c.status === "completed"
                        ? "bg-slate-500"
                        : "bg-red-400"
                  }`}
                />
                <span className="font-mono text-sm">
                  {c.agent_a_code ?? "unknown"}
                  {c.agent_b_code ? ` → ${c.agent_b_code}` : ""}
                </span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
                  {c.trigger_type}
                </span>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>{new Date(c.started_at).toLocaleString()}</p>
                {c.total_cost > 0 && (
                  <p>${Number(c.total_cost).toFixed(4)}</p>
                )}
              </div>
            </div>
            {c.summary && (
              <p className="mt-2 text-xs text-slate-400 line-clamp-2">
                {c.summary}
              </p>
            )}
            <div className="mt-2 flex gap-3 text-xs text-slate-600">
              <span>{c.total_tokens?.toLocaleString() ?? 0} tokens</span>
              <span>
                {c.openclaw_session_id?.slice(0, 8)}...
              </span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
