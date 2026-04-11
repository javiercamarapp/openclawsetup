/**
 * World Store — Bloque 4 PHASE 1
 *
 * Central state for the pixel world: sprite positions, states,
 * active conversations, ghost mode, and selected agent.
 *
 * Consumed by PixelWorldPixi, ConversationBox, AgentBar, ActivityFeed.
 */

import { create } from "zustand";

import type { AgentSprite, ConversationVisual } from "@/types";
import {
  AGENT_SPRITES,
  computeSpritePositions,
} from "@/lib/sprites/zone-layout";

interface WorldState {
  sprites: Map<string, AgentSprite>;
  conversations: ConversationVisual[];
  ghostActive: boolean;
  ghostSessionId: string | null;
  selectedAgent: string | null;
}

interface WorldActions {
  initSprites: () => void;
  updateSpritePosition: (code: string, x: number, y: number) => void;
  setSpriteTarget: (code: string, targetX: number, targetY: number) => void;
  setAgentState: (code: string, state: AgentSprite["worldState"]) => void;
  setAgentActivity: (code: string, activity: string | null) => void;
  startConversation: (conv: ConversationVisual) => void;
  updateConversationSpeech: (convId: string, speaker: string, text: string) => void;
  endConversation: (convId: string) => void;
  selectAgent: (code: string | null) => void;
  activateGhost: (sessionId: string) => void;
  deactivateGhost: () => void;
  getSprite: (code: string) => AgentSprite | undefined;
}

export const useWorldStore = create<WorldState & WorldActions>((set, get) => ({
  sprites: new Map(),
  conversations: [],
  ghostActive: false,
  ghostSessionId: null,
  selectedAgent: null,

  initSprites: () => {
    const positions = computeSpritePositions();
    const map = new Map<string, AgentSprite>();
    for (const p of positions) {
      const config = AGENT_SPRITES.find((a) => a.code === p.code);
      map.set(p.code, {
        code: p.code,
        zone: config?.zone ?? 1,
        tier: config?.tier ?? "FREE",
        borderColor: config?.borderColor ?? "#3B82F6",
        label: config?.label ?? p.code,
        x: p.x,
        y: p.y,
        targetX: p.x,
        targetY: p.y,
        worldState: "idle",
        animFrame: 0,
        currentActivity: null,
        conversationPartner: null,
        lastTargetChangeMs: Date.now(),
      });
    }
    set({ sprites: map });
  },

  updateSpritePosition: (code, x, y) => {
    const sprites = get().sprites;
    const s = sprites.get(code);
    if (s) {
      s.x = x;
      s.y = y;
      set({ sprites: new Map(sprites) });
    }
  },

  setSpriteTarget: (code, targetX, targetY) => {
    const sprites = get().sprites;
    const s = sprites.get(code);
    if (s) {
      s.targetX = targetX;
      s.targetY = targetY;
      s.lastTargetChangeMs = Date.now();
      set({ sprites: new Map(sprites) });
    }
  },

  setAgentState: (code, state) => {
    const sprites = get().sprites;
    const s = sprites.get(code);
    if (s) {
      s.worldState = state;
      set({ sprites: new Map(sprites) });
    }
  },

  setAgentActivity: (code, activity) => {
    const sprites = get().sprites;
    const s = sprites.get(code);
    if (s) {
      s.currentActivity = activity;
      set({ sprites: new Map(sprites) });
    }
  },

  startConversation: (conv) => {
    set((state) => ({
      conversations: [...state.conversations, conv],
    }));
    // Mark both agents as walking toward each other
    const sprites = get().sprites;
    const a = sprites.get(conv.agentA);
    const b = conv.agentB ? sprites.get(conv.agentB) : null;
    if (a) {
      a.worldState = "walking";
      a.conversationPartner = conv.agentB;
    }
    if (b) {
      b.worldState = "walking";
      b.conversationPartner = conv.agentA;
    }
    set({ sprites: new Map(sprites) });
  },

  updateConversationSpeech: (convId, speaker, text) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === convId ? { ...c, speaker, speechText: text } : c,
      ),
    }));
  },

  endConversation: (convId) => {
    const conv = get().conversations.find((c) => c.id === convId);
    if (conv) {
      const sprites = get().sprites;
      const a = sprites.get(conv.agentA);
      const b = conv.agentB ? sprites.get(conv.agentB) : null;
      if (a) {
        a.worldState = "idle";
        a.conversationPartner = null;
        a.currentActivity = null;
      }
      if (b) {
        b.worldState = "idle";
        b.conversationPartner = null;
        b.currentActivity = null;
      }
      set({
        sprites: new Map(sprites),
        conversations: get().conversations.filter((c) => c.id !== convId),
      });
    }
  },

  selectAgent: (code) => set({ selectedAgent: code }),

  activateGhost: (sessionId) =>
    set({ ghostActive: true, ghostSessionId: sessionId }),

  deactivateGhost: () =>
    set({ ghostActive: false, ghostSessionId: null }),

  getSprite: (code) => get().sprites.get(code),
}));
