import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function TasksPage() {
  const supabase = getServerSupabase();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, priority, assigned_to_code, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const columns = ["pending", "in_progress", "completed"] as const;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <header className="mb-6">
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-400">
          &larr; Back
        </Link>
        <h1 className="text-xl font-semibold">Tasks</h1>
        <p className="text-sm text-slate-500">
          Kanban board — tasks extracted from agent conversations
        </p>
      </header>

      <div className="grid grid-cols-3 gap-4">
        {columns.map((col) => {
          const items = (tasks ?? []).filter((t) => t.status === col);
          return (
            <div key={col} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {col.replace("_", " ")} ({items.length})
              </h2>
              {items.length === 0 && (
                <p className="rounded border border-dashed border-slate-800 p-4 text-center text-xs text-slate-600">
                  No tasks
                </p>
              )}
              {items.map((t) => (
                <div
                  key={t.id}
                  className="rounded border border-slate-800 bg-slate-900 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold ${
                        t.priority === "P0"
                          ? "text-red-400"
                          : t.priority === "P1"
                            ? "text-orange-400"
                            : t.priority === "P2"
                              ? "text-yellow-400"
                              : "text-green-400"
                      }`}
                    >
                      {t.priority}
                    </span>
                    <span className="text-sm">{t.title}</span>
                  </div>
                  {t.assigned_to_code && (
                    <p className="mt-1 text-xs text-slate-500">
                      {t.assigned_to_code}
                    </p>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </main>
  );
}
