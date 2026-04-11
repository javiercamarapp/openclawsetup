"use client";

import dynamic from "next/dynamic";

// Dynamic imports for client-only components (PixiJS, Supabase Realtime)
const PixelWorldWrapper = dynamic(
  () => import("@/components/pixel-world/PixelWorldWrapper"),
  { ssr: false },
);
const ActivityFeed = dynamic(
  () => import("@/components/activity-feed/ActivityFeed"),
  { ssr: false },
);
const KpiCards = dynamic(
  () => import("@/components/activity-feed/KpiCards"),
  { ssr: false },
);
const ConversationBox = dynamic(
  () => import("@/components/pixel-world/ConversationBox"),
  { ssr: false },
);
const AgentBar = dynamic(
  () => import("@/components/pixel-world/AgentBar"),
  { ssr: false },
);

export default function Home() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left: Canvas + Conversation Box + Agent Bar */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Pixel World Canvas */}
        <div className="flex-1 overflow-hidden p-4 pb-0">
          <PixelWorldWrapper />
        </div>

        {/* Conversation Box (collapsible) */}
        <div className="shrink-0 px-4 py-2">
          <ConversationBox />
        </div>

        {/* Agent Bar */}
        <div className="shrink-0 border-t border-gray-200 bg-white">
          <AgentBar />
        </div>
      </div>

      {/* Right: Sidebar */}
      <aside className="flex w-80 shrink-0 flex-col border-l border-gray-200 bg-white">
        {/* Activity Feed (60% top) */}
        <div className="flex-[3] overflow-hidden">
          <ActivityFeed />
        </div>

        {/* KPI Cards (40% bottom) */}
        <div className="flex-[2] border-t border-gray-200 p-3">
          <KpiCards />
        </div>
      </aside>
    </div>
  );
}
