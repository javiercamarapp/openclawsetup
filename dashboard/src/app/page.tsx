import PixelWorldWrapper from "@/components/pixel-world/PixelWorldWrapper";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
              Bloque 3 · Empresa Virtual
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              Agent Command Center
            </h1>
          </div>
          <div className="flex gap-2 text-xs text-slate-500">
            <span className="rounded bg-slate-800 px-2 py-1">
              24 agents
            </span>
            <span className="rounded bg-slate-800 px-2 py-1">
              13 crons
            </span>
            <span className="rounded bg-emerald-900 px-2 py-1 text-emerald-400">
              live
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 p-6">
        {/* Pixel World */}
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Pixel World
          </h2>
          <PixelWorldWrapper />
        </section>

        {/* Dashboard nav cards (FASE 6 stubs) */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <NavCard
            href="/tasks"
            title="Tasks"
            description="Kanban board"
            icon="T"
          />
          <NavCard
            href="/costs"
            title="Cost Center"
            description="Usage & spend"
            icon="$"
          />
          <NavCard
            href="/comms"
            title="Comm Log"
            description="Conversations"
            icon="C"
          />
          <NavCard
            href="/config"
            title="Config"
            description="Agent settings"
            icon="S"
          />
        </section>

        {/* Roadmap */}
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Roadmap
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            {[
              { id: "FASE 0-1", done: true },
              { id: "FASE 2", done: true },
              { id: "FASE 3", done: true },
              { id: "FASE 4.5+5", done: true },
              { id: "FASE 6", done: false },
              { id: "FASE 7", done: false },
              { id: "FASE 8", done: false },
            ].map((p) => (
              <span
                key={p.id}
                className={`rounded px-2 py-1 text-center ${
                  p.done
                    ? "bg-emerald-900/50 text-emerald-400"
                    : "bg-slate-800 text-slate-500"
                }`}
              >
                {p.id}
              </span>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function NavCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <a
      href={href}
      className="group rounded-lg border border-slate-800 bg-slate-900 p-4 transition-colors hover:border-slate-600 hover:bg-slate-800"
    >
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded bg-slate-800 font-mono text-sm font-bold text-slate-400 group-hover:bg-slate-700">
        {icon}
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-slate-500">{description}</p>
    </a>
  );
}
