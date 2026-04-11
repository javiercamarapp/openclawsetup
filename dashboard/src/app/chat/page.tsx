"use client";
/**
 * Chat Page — Phase 4
 *
 * Full-height split layout: ThreadList (left, 280px) + MessageView (right).
 * Shows placeholder when no thread is selected.
 */

import { MessagesSquare } from "lucide-react";

import ThreadList from "@/components/chat/ThreadList";
import MessageView from "@/components/chat/MessageView";
import { useChatStore } from "@/store/chat-store";

export default function ChatPage() {
  const activeThread = useChatStore((s) => s.activeThread);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left panel: thread list */}
      <div className="w-[280px] shrink-0">
        <ThreadList />
      </div>

      {/* Right panel: messages or placeholder */}
      <div className="flex-1 bg-gray-50">
        {activeThread ? (
          <MessageView threadId={activeThread} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-400">
            <MessagesSquare className="h-12 w-12" />
            <p className="text-sm">Select an agent to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
