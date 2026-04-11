/**
 * Sprite Loader — Bloque 4 PHASE 2
 *
 * Loads agent character PNGs from /sprites/<code>.png.
 * Each PNG is a spritesheet with animation frames.
 * Falls back to procedural colored circle if PNG is missing.
 */

import { Assets, Texture, Spritesheet, type SpritesheetData } from "pixi.js";

import { AGENT_SPRITES, TIER_COLORS } from "./zone-layout";

/** Frame dimensions in the spritesheet source */
const FRAME_W = 64;
const FRAME_H = 64;

/** Expected animation rows in spritesheet */
const ANIM_ROWS = {
  idle: 0,    // row 0: idle frames
  walk: 1,    // row 1: walk frames
  talk: 2,    // row 2: talk frames
  active: 3,  // row 3: active/special frames
} as const;

const FRAMES_PER_ROW = 4;

/** Cached textures per agent */
const textureCache = new Map<string, Texture>();
const spritesheetCache = new Map<string, Spritesheet>();

/**
 * Load a single agent's spritesheet. If the PNG doesn't exist or
 * can't be parsed as a spritesheet, returns null (use fallback).
 */
export async function loadAgentSpritesheet(
  code: string,
): Promise<Spritesheet | null> {
  if (spritesheetCache.has(code)) {
    return spritesheetCache.get(code)!;
  }

  try {
    const path = `/sprites/${code}.png`;
    const texture = await Assets.load<Texture>(path);

    if (!texture || texture === Texture.EMPTY) return null;

    // Detect spritesheet dimensions
    const source = texture.source;
    const imgW = source.width;
    const imgH = source.height;
    const cols = Math.max(1, Math.floor(imgW / FRAME_W));
    const rows = Math.max(1, Math.floor(imgH / FRAME_H));

    // Build spritesheet data
    const frames: SpritesheetData["frames"] = {};
    const animations: Record<string, string[]> = {
      idle: [],
      walk: [],
      talk: [],
      active: [],
    };

    for (let row = 0; row < rows; row++) {
      const animName = Object.keys(ANIM_ROWS).find(
        (k) => ANIM_ROWS[k as keyof typeof ANIM_ROWS] === row,
      ) ?? "idle";

      for (let col = 0; col < Math.min(cols, FRAMES_PER_ROW); col++) {
        const frameId = `${code}_${animName}_${col}`;
        frames[frameId] = {
          frame: { x: col * FRAME_W, y: row * FRAME_H, w: FRAME_W, h: FRAME_H },
          sourceSize: { w: FRAME_W, h: FRAME_H },
          spriteSourceSize: { x: 0, y: 0, w: FRAME_W, h: FRAME_H },
        };
        animations[animName].push(frameId);
      }
    }

    // If image is just a single frame (portrait), use it as idle
    if (cols === 1 && rows === 1) {
      const frameId = `${code}_idle_0`;
      frames[frameId] = {
        frame: { x: 0, y: 0, w: imgW, h: imgH },
        sourceSize: { w: imgW, h: imgH },
        spriteSourceSize: { x: 0, y: 0, w: imgW, h: imgH },
      };
      animations.idle = [frameId];
      animations.walk = [frameId];
      animations.talk = [frameId];
      animations.active = [frameId];
    }

    const spritesheetData: SpritesheetData = {
      frames,
      meta: {
        scale: 1,
      },
      animations,
    };

    const sheet = new Spritesheet(texture, spritesheetData);
    await sheet.parse();
    spritesheetCache.set(code, sheet);
    return sheet;
  } catch {
    return null;
  }
}

/**
 * Get the base texture for an agent. Loads from /sprites/<code>.png
 * or returns null if not available.
 */
export async function loadAgentTexture(
  code: string,
): Promise<Texture | null> {
  if (textureCache.has(code)) {
    return textureCache.get(code)!;
  }

  try {
    const path = `/sprites/${code}.png`;
    const texture = await Assets.load<Texture>(path);
    if (texture && texture !== Texture.EMPTY) {
      textureCache.set(code, texture);
      return texture;
    }
  } catch {
    // PNG not found — caller will use fallback
  }

  return null;
}

/**
 * Get the tier color for an agent code.
 */
export function getTierColor(code: string): string {
  const agent = AGENT_SPRITES.find((a) => a.code === code);
  if (!agent) return TIER_COLORS.FREE;
  return agent.borderColor;
}

/**
 * Preload all agent textures. Called once on mount.
 */
export async function preloadAllSprites(): Promise<void> {
  const loadPromises = AGENT_SPRITES.map((a) =>
    loadAgentTexture(a.code).catch(() => null),
  );
  await Promise.allSettled(loadPromises);
}
