export default function Home() {
  const phases = [
    { id: "FASE 0", label: "Infra setup", status: "done" },
    { id: "FASE 1", label: "Supabase cache schema", status: "pending" },
    { id: "FASE 2", label: "OpenClaw gateway client", status: "pending" },
    { id: "FASE 3", label: "Gateway event subscriber", status: "pending" },
    { id: "FASE 4", label: "Orchestrator (delegated to OpenClaw)", status: "pending" },
    { id: "FASE 4.5", label: "Sprite factory", status: "pending" },
    { id: "FASE 5", label: "Pixel world (PixiJS)", status: "pending" },
    { id: "FASE 6", label: "Dashboard screens", status: "pending" },
    { id: "FASE 7", label: "Ghost mode", status: "pending" },
    { id: "FASE 8", label: "Auto-start + polish", status: "pending" },
  ];

  return (
    <main className="min-h-screen p-10 font-sans">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-mono uppercase tracking-wider text-[color:var(--muted-foreground)]">
            Bloque 3 · Agent Command Center
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Dashboard boot OK
          </h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            Next.js 16 + React 19 + Tailwind 4 + PixiJS 8 + Supabase + Zustand.
            Read-only visualizer over the OpenClaw gateway at{" "}
            <code className="font-mono text-xs">ws://127.0.0.1:18789</code>.
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
            Roadmap
          </h2>
          <ul className="space-y-1 font-mono text-sm">
            {phases.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 border-b border-[color:var(--border)] py-2"
              >
                <span
                  aria-label={p.status}
                  className={
                    p.status === "done"
                      ? "inline-block h-2 w-2 rounded-full bg-emerald-500"
                      : "inline-block h-2 w-2 rounded-full bg-zinc-300"
                  }
                />
                <span className="w-20 text-xs text-[color:var(--muted-foreground)]">
                  {p.id}
                </span>
                <span>{p.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="pt-4 text-xs text-[color:var(--muted-foreground)]">
          Not fork of{" "}
          <a
            href="https://github.com/kirillkuzin/clawboard"
            className="underline"
          >
            kirillkuzin/clawboard
          </a>
          . Reference-only — patterns adapted, code clean-room.
        </footer>
      </div>
    </main>
  );
}
