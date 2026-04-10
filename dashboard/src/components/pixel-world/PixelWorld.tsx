"use client";
/**
 * PixelWorld — Bloque 3 FASE 5
 *
 * The pixel-art canvas rendering 24 agent sprites distributed across
 * 9 division zones. Uses PixiJS 8 via @pixi/react for React
 * integration. Each sprite is a simple colored rectangle with a
 * tier-based border and a name label — procedural, no image assets.
 *
 * Data flow:
 *   1. On mount: reads initial positions from zone-layout.ts
 *   2. Subscribes to Supabase Realtime on `world_events` for live
 *      updates (conversation_start → speech bubble, agent_move →
 *      walk animation, etc.)
 *   3. Uses requestAnimationFrame for smooth position interpolation
 *
 * The canvas is 750×380 and responsive (scales down on mobile).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  AGENT_SPRITES,
  CANVAS_H,
  CANVAS_W,
  computeSpritePositions,
  TIER_COLORS,
  ZONES,

} from "@/lib/sprites/zone-layout";

// ── Types ────────────────────────────────────────────────────────

interface SpriteState {
  code: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  tier: string;
  borderColor: string;
  label: string;
  worldState: "idle" | "talking" | "walking" | "active";
}

// ── Sprite size ──────────────────────────────────────────────────
const SPRITE_W = 32;
const SPRITE_H = 32;
const LABEL_FONT = "9px monospace";

// ── Component ────────────────────────────────────────────────────

export default function PixelWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spritesRef = useRef<Map<string, SpriteState>>(new Map());
  const animFrameRef = useRef<number>(0);
  const [ready, setReady] = useState(false);

  // Initialize sprites from zone layout
  useEffect(() => {
    const positions = computeSpritePositions();
    const map = new Map<string, SpriteState>();
    for (const p of positions) {
      map.set(p.code, {
        code: p.code,
        x: p.x,
        y: p.y,
        targetX: p.x,
        targetY: p.y,
        tier: p.tier,
        borderColor: p.borderColor,
        label: p.label,
        worldState: "idle",
      });
    }
    spritesRef.current = map;
    setReady(true);
  }, []);

  // Canvas rendering loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.fillStyle = "#0F172A"; // slate-900 background
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw zones (dashed borders + labels)
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "left";
    for (const zone of ZONES) {
      ctx.strokeStyle = zone.color + "60"; // 38% opacity
      ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
      ctx.fillStyle = zone.color + "AA";
      ctx.fillText(zone.name, zone.x + 4, zone.y + 12);
    }
    ctx.setLineDash([]);

    // Draw sprites
    const sprites = spritesRef.current;
    for (const s of sprites.values()) {
      // Interpolate position toward target
      const speed = 0.08;
      s.x += (s.targetX - s.x) * speed;
      s.y += (s.targetY - s.y) * speed;

      const sx = s.x - SPRITE_W / 2;
      const sy = s.y - SPRITE_H / 2;

      // Body (dark rectangle)
      ctx.fillStyle = "#1E293B"; // slate-800
      ctx.fillRect(sx, sy, SPRITE_W, SPRITE_H);

      // Tier border (2px)
      ctx.strokeStyle = s.borderColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, SPRITE_W, SPRITE_H);

      // State indicator
      if (s.worldState === "talking") {
        // Speech bubble
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(s.x + SPRITE_W / 2 - 2, sy - 6, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0F172A";
        ctx.font = "bold 7px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("...", s.x + SPRITE_W / 2 - 2, sy - 4);
      } else if (s.worldState === "walking") {
        // Walking dots
        const t = Date.now() % 1000;
        const dotCount = Math.floor(t / 333) + 1;
        ctx.fillStyle = s.borderColor;
        for (let i = 0; i < dotCount; i++) {
          ctx.fillRect(sx + SPRITE_W + 2 + i * 4, s.y + 2, 2, 2);
        }
      }

      // Inner icon (first 2 chars of agent code, like an avatar)
      ctx.fillStyle = s.borderColor;
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const initials = s.code.slice(0, 2).toUpperCase();
      ctx.fillText(initials, s.x, s.y);

      // Label below sprite
      ctx.fillStyle = "#94A3B8"; // slate-400
      ctx.font = LABEL_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const shortLabel =
        s.label.length > 12 ? s.label.slice(0, 11) + "…" : s.label;
      ctx.fillText(shortLabel, s.x, sy + SPRITE_H + 2);
    }

    // Stats overlay (top-right)
    const talking = [...sprites.values()].filter(
      (s) => s.worldState === "talking",
    ).length;
    const walking = [...sprites.values()].filter(
      (s) => s.worldState === "walking",
    ).length;
    ctx.fillStyle = "#64748B";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(
      `${sprites.size} agents | ${talking} talking | ${walking} walking`,
      CANVAS_W - 8,
      4,
    );

    animFrameRef.current = requestAnimationFrame(draw);
  }, []);

  // Start/stop animation loop
  useEffect(() => {
    if (!ready) return;
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [ready, draw]);

  // Supabase Realtime subscription for world_events
  useEffect(() => {
    if (!ready) return;

    // Dynamic import to avoid SSR issues with Supabase Realtime
    let cleanup: (() => void) | undefined;

    (async () => {
      const { getBrowserSupabase } = await import(
        "@/lib/supabase/browser"
      );
      const supabase = getBrowserSupabase();
      const channel = supabase
        .channel("world")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "world_events",
          },
          (payload) => {
            const evt = payload.new as {
              event_type: string;
              payload: Record<string, unknown>;
            };
            handleWorldEvent(evt, spritesRef.current);
          },
        )
        .subscribe();

      cleanup = () => {
        supabase.removeChannel(channel);
      };
    })();

    return () => cleanup?.();
  }, [ready]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full"
        style={{ imageRendering: "pixelated" }}
      />
      {/* Legend */}
      <div className="flex gap-4 border-t border-slate-800 px-3 py-1.5 text-xs text-slate-500">
        {Object.entries(TIER_COLORS).map(([tier, color]) => (
          <span key={tier} className="flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: color }}
            />
            {tier}
          </span>
        ))}
        <span className="ml-auto">{AGENT_SPRITES.length} sprites</span>
      </div>
    </div>
  );
}

// ── Event handler ────────────────────────────────────────────────

function handleWorldEvent(
  evt: { event_type: string; payload: Record<string, unknown> },
  sprites: Map<string, SpriteState>,
) {
  switch (evt.event_type) {
    case "conversation_start": {
      const agent = evt.payload.agent as string | undefined;
      if (agent) {
        const s = sprites.get(agent) ?? sprites.get(agent.toLowerCase());
        if (s) s.worldState = "talking";
      }
      break;
    }
    case "conversation_end": {
      // Reset all talking sprites to idle (simple approach)
      for (const s of sprites.values()) {
        if (s.worldState === "talking") s.worldState = "idle";
      }
      break;
    }
    case "agent_move": {
      const from = evt.payload.from as string | undefined;
      const to = evt.payload.to as string | undefined;
      if (from) {
        const s = sprites.get(from.toLowerCase());
        if (s) s.worldState = "walking";
      }
      if (to) {
        const s = sprites.get(to.toLowerCase());
        if (s) s.worldState = "walking";
      }
      break;
    }
    case "agent_error": {
      const agent = evt.payload.skill as string | undefined;
      if (agent) {
        const s = sprites.get(agent.toLowerCase());
        if (s) s.worldState = "idle"; // flash red? for now just idle
      }
      break;
    }
    case "ghost_join": {
      // FASE 7 — ghost avatar appearance
      break;
    }
    case "ghost_leave": {
      // FASE 7 — ghost avatar disappearance
      break;
    }
  }
}
