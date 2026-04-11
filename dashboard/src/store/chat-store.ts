/**
 * Chat Store — Bloque 4 PHASE 1
 *
 * Direct chat threads between Javier and agents.
 * Each agent has its own thread. Group threads use "group:<name>".
 */

import { create } from "zustand";

import type { ChatThread, DirectMessage } from "@/types";

interface ChatState {
  threads: Map<string, ChatThread>;
  activeThread: string | null;
  loading: boolean;
}

interface ChatActions {
  setActiveThread: (agentCode: string | null) => void;
  addMessage: (message: DirectMessage) => void;
  setThreadMessages: (agentCode: string, messages: DirectMessage[]) => void;
  markRead: (agentCode: string) => void;
  setLoading: (loading: boolean) => void;
  initThread: (agentCode: string) => void;
}

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  threads: new Map(),
  activeThread: null,
  loading: false,

  setActiveThread: (agentCode) => {
    set({ activeThread: agentCode });
    if (agentCode) {
      get().markRead(agentCode);
    }
  },

  addMessage: (message) => {
    const threads = get().threads;
    const thread = threads.get(message.thread_id);
    if (thread) {
      thread.messages.push(message);
      thread.lastMessage = message.content;
      thread.lastMessageAt = message.created_at;
      if (message.thread_id !== get().activeThread) {
        thread.unreadCount += 1;
      }
      set({ threads: new Map(threads) });
    } else {
      // Auto-init thread
      const newThread: ChatThread = {
        agentCode: message.thread_id,
        messages: [message],
        unreadCount: message.thread_id !== get().activeThread ? 1 : 0,
        lastMessage: message.content,
        lastMessageAt: message.created_at,
      };
      threads.set(message.thread_id, newThread);
      set({ threads: new Map(threads) });
    }
  },

  setThreadMessages: (agentCode, messages) => {
    const threads = get().threads;
    const existing = threads.get(agentCode);
    const sorted = messages.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    threads.set(agentCode, {
      agentCode,
      messages: sorted,
      unreadCount: existing?.unreadCount ?? 0,
      lastMessage: sorted.at(-1)?.content ?? null,
      lastMessageAt: sorted.at(-1)?.created_at ?? null,
    });
    set({ threads: new Map(threads) });
  },

  markRead: (agentCode) => {
    const threads = get().threads;
    const thread = threads.get(agentCode);
    if (thread) {
      thread.unreadCount = 0;
      set({ threads: new Map(threads) });
    }
  },

  setLoading: (loading) => set({ loading }),

  initThread: (agentCode) => {
    const threads = get().threads;
    if (!threads.has(agentCode)) {
      threads.set(agentCode, {
        agentCode,
        messages: [],
        unreadCount: 0,
        lastMessage: null,
        lastMessageAt: null,
      });
      set({ threads: new Map(threads) });
    }
  },
}));
