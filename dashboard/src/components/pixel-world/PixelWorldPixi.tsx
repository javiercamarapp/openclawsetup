"use client";
/**
 * PixelWorldPixi — Bloque 4 PHASE 2
 *
 * PixiJS 8 canvas rendering 24 agent sprites with real character
 * images, zone backgrounds, pathfinding, idle animations, speech
 * bubbles, and conversation visualization.
 *
 * Replaces the Canvas 2D PixelWorld.tsx with proper GPU-accelerated
 * rendering via @pixi/react.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Application, extend, useApplication, useTick } from "@pixi/react";
import {
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
  Assets,
} from "pixi.js";

import { useWorldStore } from "@/store/world-store";
import {
  CANVAS_W,
  CANVAS_H,
  ZONES,
  AGENT_SPRITES,
  TIER_COLORS,
} from "@/lib/sprites/zone-layout";
import {
  pickRandomTarget,
  moveToward,
  isAtTarget,
  getRandomWaitMs,
  getZone,
} from "@/lib/sprites/pathfinding";
import type { AgentSprite as AgentSpriteType } from "@/types";

// Extend pixi.js classes for JSX usage
extend({ Container, Graphics, Sprite, Text });

// ── Constants ──────────────────────────────────────────────────

const SPRITE_DISPLAY_SIZE = 32;
const LABEL_STYLE = new TextStyle({
  fontFamily: "monospace",
  fontSize: 9,
  fill: 0x94a3b8,
  align: "center",
});
const SPEECH_STYLE = new TextStyle({
  fontFamily: "Inter, sans-serif",
  fontSize: 10,
  fill: 0x1f2937,
  wordWrap: true,
  wordWrapWidth: 160,
});
const ZONE_LABEL_STYLE = new TextStyle({
  fontFamily: "sans-serif",
  fontSize: 10,
  fontWeight: "bold",
});

// ── Zone Background Drawing ────────────────────────────────────

function drawZones(g: Graphics) {
  g.clear();

  // Dark canvas background
  g.rect(0, 0, CANVAS_W, CANVAS_H);
  g.fill({ color: 0x0f172a });

  // Subtle grid
  g.setStrokeStyle({ width: 0.5, color: 0x1e293b });
  for (let x = 0; x < CANVAS_W; x += 16) {
    g.moveTo(x, 0);
    g.lineTo(x, CANVAS_H);
  }
  for (let y = 0; y < CANVAS_H; y += 16) {
    g.moveTo(0, y);
    g.lineTo(CANVAS_W, y);
  }
  g.stroke();

  // Zone borders (dashed effect via small segments)
  for (const zone of ZONES) {
    const color = parseInt(zone.color.replace("#", ""), 16);

    // Zone background fill (3% opacity)
    g.rect(zone.x, zone.y, zone.w, zone.h);
    g.fill({ color, alpha: 0.03 });

    // Dashed border
    g.setStrokeStyle({ width: 1, color, alpha: 0.35 });
    const dashLen = 4;
    const gapLen = 4;

    // Top
    for (let x = zone.x; x < zone.x + zone.w; x += dashLen + gapLen) {
      g.moveTo(x, zone.y);
      g.lineTo(Math.min(x + dashLen, zone.x + zone.w), zone.y);
    }
    // Bottom
    for (let x = zone.x; x < zone.x + zone.w; x += dashLen + gapLen) {
      g.moveTo(x, zone.y + zone.h);
      g.lineTo(Math.min(x + dashLen, zone.x + zone.w), zone.y + zone.h);
    }
    // Left
    for (let y = zone.y; y < zone.y + zone.h; y += dashLen + gapLen) {
      g.moveTo(zone.x, y);
      g.lineTo(zone.x, Math.min(y + dashLen, zone.y + zone.h));
    }
    // Right
    for (let y = zone.y; y < zone.y + zone.h; y += dashLen + gapLen) {
      g.moveTo(zone.x + zone.w, y);
      g.lineTo(zone.x + zone.w, Math.min(y + dashLen, zone.y + zone.h));
    }
    g.stroke();
  }
}

// ── Agent Sprite Component ─────────────────────────────────────

function AgentSpriteView({
  agent,
  texture,
}: {
  agent: AgentSpriteType;
  texture: Texture | null;
}) {
  const borderColor = parseInt(agent.borderColor.replace("#", ""), 16);

  // Draw the agent body (rectangle fallback or image)
  const drawBody = useCallback(
    (g: Graphics) => {
      g.clear();
      const hw = SPRITE_DISPLAY_SIZE / 2;

      if (!texture) {
        // Fallback: colored rectangle with initials
        g.roundRect(-hw, -hw, SPRITE_DISPLAY_SIZE, SPRITE_DISPLAY_SIZE, 4);
        g.fill({ color: 0x1e293b });
        g.setStrokeStyle({ width: 2, color: borderColor });
        g.stroke();
      } else {
        // Border around sprite image
        g.roundRect(-hw - 1, -hw - 1, SPRITE_DISPLAY_SIZE + 2, SPRITE_DISPLAY_SIZE + 2, 4);
        g.setStrokeStyle({ width: 2, color: borderColor });
        g.stroke();
      }

      // State indicators
      if (agent.worldState === "talking") {
        // Speech bubble dot above
        g.circle(hw - 2, -hw - 8, 6);
        g.fill({ color: 0xffffff });
        g.circle(hw - 2, -hw - 8, 5);
        g.fill({ color: 0xffffff });
      } else if (agent.worldState === "active") {
        // Glow outline
        g.roundRect(-hw - 3, -hw - 3, SPRITE_DISPLAY_SIZE + 6, SPRITE_DISPLAY_SIZE + 6, 6);
        g.setStrokeStyle({ width: 1.5, color: borderColor, alpha: 0.5 });
        g.stroke();
      }
    },
    [texture, borderColor, agent.worldState],
  );

  // Walking animation: subtle bob
  const bobOffset =
    agent.worldState === "walking"
      ? Math.sin(Date.now() / 150) * 2
      : 0;

  // Idle: subtle breathing
  const breatheOffset =
    agent.worldState === "idle"
      ? Math.sin(Date.now() / 1000) * 0.5
      : 0;

  return (
    <pixiContainer x={agent.x} y={agent.y + bobOffset + breatheOffset}>
      {/* Body graphics */}
      <pixiGraphics draw={drawBody} />

      {/* Character image (if loaded) */}
      {texture && (
        <pixiSprite
          texture={texture}
          anchor={0.5}
          width={SPRITE_DISPLAY_SIZE}
          height={SPRITE_DISPLAY_SIZE}
        />
      )}

      {/* Initials (fallback when no texture) */}
      {!texture && (
        <pixiText
          text={agent.code.slice(0, 2).toUpperCase()}
          style={
            new TextStyle({
              fontFamily: "monospace",
              fontSize: 11,
              fontWeight: "bold",
              fill: borderColor,
            })
          }
          anchor={0.5}
        />
      )}

      {/* Name label */}
      <pixiText
        text={
          agent.label.length > 12
            ? agent.label.slice(0, 11) + "…"
            : agent.label
        }
        style={LABEL_STYLE}
        anchor={{ x: 0.5, y: 0 }}
        y={SPRITE_DISPLAY_SIZE / 2 + 3}
      />

      {/* Activity bubble */}
      {agent.currentActivity && agent.worldState === "talking" && (
        <pixiContainer y={-SPRITE_DISPLAY_SIZE / 2 - 20}>
          <pixiGraphics
            draw={(g: Graphics) => {
              g.clear();
              g.roundRect(-85, -14, 170, 22, 6);
              g.fill({ color: 0xffffff, alpha: 0.95 });
              g.setStrokeStyle({ width: 1, color: 0xe5e7eb });
              g.stroke();
              // Pointer triangle
              g.moveTo(-4, 8);
              g.lineTo(0, 14);
              g.lineTo(4, 8);
              g.fill({ color: 0xffffff });
            }}
          />
          <pixiText
            text={
              agent.currentActivity.length > 30
                ? agent.currentActivity.slice(0, 29) + "..."
                : agent.currentActivity
            }
            style={SPEECH_STYLE}
            anchor={0.5}
            y={-4}
          />
        </pixiContainer>
      )}
    </pixiContainer>
  );
}

// ── Conversation Lines ─────────────────────────────────────────

function ConversationLines() {
  const conversations = useWorldStore((s) => s.conversations);
  const sprites = useWorldStore((s) => s.sprites);

  const drawLines = useCallback(
    (g: Graphics) => {
      g.clear();
      for (const conv of conversations) {
        if (conv.status !== "active") continue;
        const a = sprites.get(conv.agentA);
        const b = conv.agentB ? sprites.get(conv.agentB) : null;
        if (!a || !b) continue;

        // Amber dashed line
        const dashLen = 6;
        const gapLen = 4;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.floor(dist / (dashLen + gapLen));

        g.setStrokeStyle({ width: 1.5, color: 0xf59e0b, alpha: 0.4 });
        for (let i = 0; i < steps; i++) {
          const t0 = (i * (dashLen + gapLen)) / dist;
          const t1 = Math.min((i * (dashLen + gapLen) + dashLen) / dist, 1);
          g.moveTo(a.x + dx * t0, a.y + dy * t0);
          g.lineTo(a.x + dx * t1, a.y + dy * t1);
        }
        g.stroke();
      }
    },
    [conversations, sprites],
  );

  return <pixiGraphics draw={drawLines} />;
}

// ── Zone Labels ────────────────────────────────────────────────

function ZoneLabels() {
  return (
    <pixiContainer>
      {ZONES.map((zone) => (
        <pixiText
          key={zone.id}
          text={zone.name}
          style={
            new TextStyle({
              ...ZONE_LABEL_STYLE,
              fill: parseInt(zone.color.replace("#", ""), 16),
            })
          }
          x={zone.x + 6}
          y={zone.y + 4}
          alpha={0.7}
        />
      ))}
    </pixiContainer>
  );
}

// ── Stats Overlay ──────────────────────────────────────────────

function StatsOverlay() {
  const sprites = useWorldStore((s) => s.sprites);
  const talking = [...sprites.values()].filter(
    (s) => s.worldState === "talking",
  ).length;
  const walking = [...sprites.values()].filter(
    (s) => s.worldState === "walking",
  ).length;

  return (
    <pixiText
      text={`${sprites.size} agents | ${talking} talking | ${walking} walking`}
      style={
        new TextStyle({
          fontFamily: "monospace",
          fontSize: 10,
          fill: 0x64748b,
        })
      }
      anchor={{ x: 1, y: 0 }}
      x={CANVAS_W - 8}
      y={4}
    />
  );
}

// ── World Ticker (animation + pathfinding) ─────────────────────

function WorldTicker() {
  const sprites = useWorldStore((s) => s.sprites);

  useTick(() => {
    // Move sprites toward their targets and manage pathfinding
    for (const agent of sprites.values()) {
      if (agent.worldState === "talking") continue; // Don't move while talking

      // Check if it's time to pick a new target
      const now = Date.now();
      if (
        agent.worldState === "idle" &&
        isAtTarget(agent, { x: agent.targetX, y: agent.targetY })
      ) {
        const elapsed = now - agent.lastTargetChangeMs;
        if (elapsed > getRandomWaitMs()) {
          const zone = getZone(agent.zone);
          if (zone) {
            const target = pickRandomTarget(zone);
            agent.targetX = target.x;
            agent.targetY = target.y;
            agent.worldState = "walking";
            agent.lastTargetChangeMs = now;
          }
        }
      }

      // Move toward target
      if (agent.worldState === "walking") {
        const result = moveToward(
          agent,
          { x: agent.targetX, y: agent.targetY },
        );
        agent.x = result.x;
        agent.y = result.y;
        if (result.arrived) {
          agent.worldState = "idle";
          agent.lastTargetChangeMs = now;
        }
      }

      // Increment animation frame
      agent.animFrame = (agent.animFrame + 1) % 60;
    }
  });

  return null;
}

// ── Main PixiJS World ──────────────────────────────────────────

function WorldContent() {
  const sprites = useWorldStore((s) => s.sprites);
  const [textures, setTextures] = useState<Map<string, Texture>>(new Map());

  // Load textures on mount
  useEffect(() => {
    async function loadTextures() {
      const loaded = new Map<string, Texture>();
      for (const agent of AGENT_SPRITES) {
        try {
          const tex = await Assets.load<Texture>(`/sprites/${agent.code}.png`);
          if (tex && tex !== Texture.EMPTY) {
            loaded.set(agent.code, tex);
          }
        } catch {
          // No PNG for this agent — will use fallback
        }
      }
      setTextures(loaded);
    }
    loadTextures();
  }, []);

  const agents = [...sprites.values()];

  return (
    <>
      {/* Background + Zones */}
      <pixiGraphics draw={drawZones} />

      {/* Zone Labels */}
      <ZoneLabels />

      {/* Conversation Lines */}
      <ConversationLines />

      {/* Agent Sprites */}
      {agents.map((agent) => (
        <AgentSpriteView
          key={agent.code}
          agent={agent}
          texture={textures.get(agent.code) ?? null}
        />
      ))}

      {/* Stats Overlay */}
      <StatsOverlay />

      {/* Animation Ticker */}
      <WorldTicker />
    </>
  );
}

export default function PixelWorldPixi() {
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-slate-700">
      <Application
        width={CANVAS_W}
        height={CANVAS_H}
        backgroundAlpha={0}
        antialias={false}
        resolution={1}
      >
        <WorldContent />
      </Application>

      {/* Legend */}
      <div className="flex gap-4 border-t border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-500">
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
