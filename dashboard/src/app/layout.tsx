import type { Metadata } from "next";
import "./globals.css";

import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Agent Command Center — Empresa Virtual",
  description: "24 AI agents, 13 crons, real-time dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
