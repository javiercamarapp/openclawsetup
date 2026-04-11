"use client";
/**
 * AppShell — Bloque 4 PHASE 1
 *
 * Main layout wrapper. Header on top, content below.
 * Provides Zustand store initialization and Supabase Realtime.
 */

import dynamic from "next/dynamic";

import Header from "./Header";

// Dynamic import to avoid SSR issues with Supabase Realtime
const WorldEventsProvider = dynamic(
  () =>
    import("@/hooks/use-world-events").then((m) => m.WorldEventsProvider),
  { ssr: false },
);

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorldEventsProvider>
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Header />
        <main className="flex-1">{children}</main>
      </div>
    </WorldEventsProvider>
  );
}
