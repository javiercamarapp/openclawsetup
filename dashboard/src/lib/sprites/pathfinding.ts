/**
 * Pathfinding — Bloque 4 PHASE 2
 *
 * Simple random walk within zone bounds. Each agent picks
 * a random target point within their zone every 3-8s and
 * moves toward it at ~1px/frame.
 */

import type { Zone } from "./zone-layout";
import { ZONES } from "./zone-layout";

const ZONE_PADDING = 20; // px padding from zone edges
const MOVE_SPEED = 0.8; // px per frame
const ARRIVAL_THRESHOLD = 3; // px

/**
 * Pick a random target point within a zone's bounds.
 */
export function pickRandomTarget(zone: Zone): { x: number; y: number } {
  const minX = zone.x + ZONE_PADDING;
  const maxX = zone.x + zone.w - ZONE_PADDING;
  const minY = zone.y + ZONE_PADDING + 14; // extra offset for zone label
  const maxY = zone.y + zone.h - ZONE_PADDING;

  return {
    x: minX + Math.random() * (maxX - minX),
    y: minY + Math.random() * (maxY - minY),
  };
}

/**
 * Move one step toward a target position.
 * Returns new position and whether the agent has arrived.
 */
export function moveToward(
  current: { x: number; y: number },
  target: { x: number; y: number },
  speed: number = MOVE_SPEED,
): { x: number; y: number; arrived: boolean } {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= ARRIVAL_THRESHOLD) {
    return { x: target.x, y: target.y, arrived: true };
  }

  const ratio = speed / dist;
  return {
    x: current.x + dx * ratio,
    y: current.y + dy * ratio,
    arrived: false,
  };
}

/**
 * Check if an agent is at its target.
 */
export function isAtTarget(
  current: { x: number; y: number },
  target: { x: number; y: number },
): boolean {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  return Math.sqrt(dx * dx + dy * dy) <= ARRIVAL_THRESHOLD;
}

/**
 * Get a random wait interval before picking a new target (3-8 seconds).
 */
export function getRandomWaitMs(): number {
  return 3000 + Math.random() * 5000;
}

/**
 * Find the zone by ID.
 */
export function getZone(zoneId: number): Zone | undefined {
  return ZONES.find((z) => z.id === zoneId);
}

/**
 * Compute a meeting point between two agents for conversations.
 * Returns the midpoint between the two agents' positions,
 * clamped to the first agent's zone.
 */
export function getMeetingPoint(
  posA: { x: number; y: number },
  posB: { x: number; y: number },
  zoneA: Zone,
): { x: number; y: number } {
  const midX = (posA.x + posB.x) / 2;
  const midY = (posA.y + posB.y) / 2;

  // Clamp to zone A bounds
  return {
    x: Math.max(
      zoneA.x + ZONE_PADDING,
      Math.min(zoneA.x + zoneA.w - ZONE_PADDING, midX),
    ),
    y: Math.max(
      zoneA.y + ZONE_PADDING + 14,
      Math.min(zoneA.y + zoneA.h - ZONE_PADDING, midY),
    ),
  };
}
