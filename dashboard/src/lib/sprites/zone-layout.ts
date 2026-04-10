/**
 * Zone layout — Bloque 3 FASE 4.5
 *
 * Defines the 9 visual zones of the pixel world canvas, each
 * containing a cluster of agent sprites. Layout locked in
 * `dashboard/supabase/NOTES.md` "Final 9-zone layout".
 *
 * Canvas size: 750×380 (per blueprint FASE 5).
 * Zone coordinates are { x, y, w, h } in canvas pixels.
 */

export interface Zone {
  id: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string; // dashed border color
}

export interface AgentSpriteConfig {
  code: string;
  zone: number;
  tier: "LOCAL" | "FREE" | "PAID" | "PREMIUM";
  borderColor: string;
  label: string;
}

// ── Canvas dimensions ────────────────────────────────────────────
export const CANVAS_W = 750;
export const CANVAS_H = 380;

// ── Tier border colors (from NOTES.md §3) ────────────────────────
export const TIER_COLORS: Record<string, string> = {
  LOCAL: "#10B981",
  FREE: "#3B82F6",
  PAID: "#F59E0B",
  PREMIUM: "#A855F7",
};

// ── 9 zones (3×3 grid layout) ────────────────────────────────────
// Row 1: Code Ops (wide) | Revenue | Brand & Content
// Row 2: Ops & Finance | Product | AI Ops
// Row 3: Strategy | Comms & Lang | Workhorse
const PAD = 8;
const COL_W = Math.floor((CANVAS_W - PAD * 4) / 3);
const ROW_H = Math.floor((CANVAS_H - PAD * 4) / 3);

function zoneRect(col: number, row: number): { x: number; y: number; w: number; h: number } {
  return {
    x: PAD + col * (COL_W + PAD),
    y: PAD + row * (ROW_H + PAD),
    w: COL_W,
    h: ROW_H,
  };
}

export const ZONES: Zone[] = [
  { id: 1, name: "Code Ops",        ...zoneRect(0, 0), color: "#6366F1" },
  { id: 2, name: "Revenue / Sales", ...zoneRect(1, 0), color: "#EF4444" },
  { id: 3, name: "Brand & Content", ...zoneRect(2, 0), color: "#EC4899" },
  { id: 4, name: "Ops & Finance",   ...zoneRect(0, 1), color: "#14B8A6" },
  { id: 5, name: "Product & Growth",...zoneRect(1, 1), color: "#F97316" },
  { id: 6, name: "AI Ops",          ...zoneRect(2, 1), color: "#8B5CF6" },
  { id: 7, name: "Strategy",        ...zoneRect(0, 2), color: "#0EA5E9" },
  { id: 8, name: "Comms & Lang",    ...zoneRect(1, 2), color: "#84CC16" },
  { id: 9, name: "Workhorse",       ...zoneRect(2, 2), color: "#F59E0B" },
];

// ── Agent → zone + tier mapping (from NOTES.md + personas-to-agents.json) ──

export const AGENT_SPRITES: AgentSpriteConfig[] = [
  // Zone 1: Code Ops (6)
  { code: "kimi-frontend",    zone: 1, tier: "PAID",    borderColor: TIER_COLORS.PAID,    label: "kimi-frontend" },
  { code: "minimax-code",     zone: 1, tier: "FREE",    borderColor: TIER_COLORS.FREE,    label: "minimax-code" },
  { code: "qwen-coder",       zone: 1, tier: "FREE",    borderColor: TIER_COLORS.FREE,    label: "qwen-coder" },
  { code: "deepseek-code",    zone: 1, tier: "PAID",    borderColor: TIER_COLORS.PAID,    label: "deepseek-code" },
  { code: "kimi-thinking",    zone: 1, tier: "PAID",    borderColor: TIER_COLORS.PAID,    label: "kimi-thinking" },
  { code: "qwen-coder-flash", zone: 1, tier: "PAID",    borderColor: TIER_COLORS.PAID,    label: "qwen-coder-flash" },

  // Zone 2: Revenue / Sales (1)
  { code: "grok-sales",       zone: 2, tier: "PAID",    borderColor: TIER_COLORS.PAID,    label: "grok-sales" },

  // Zone 3: Brand & Content (4)
  { code: "premium",          zone: 3, tier: "PREMIUM",  borderColor: TIER_COLORS.PREMIUM, label: "premium" },
  { code: "hermes-405b",      zone: 3, tier: "FREE",    borderColor: TIER_COLORS.FREE,    label: "hermes-405b" },
  { code: "gemma-vision",     zone: 3, tier: "FREE",    borderColor: TIER_COLORS.FREE,    label: "gemma-vision" },
  { code: "trinity-creative", zone: 3, tier: "FREE",    borderColor: TIER_COLORS.FREE,    label: "trinity-creative" },

  // Zone 4: Ops & Finance (2)
  { code: "qwen-finance",     zone: 4, tier: "PAID",    borderColor: TIER_COLORS.PAID,    label: "qwen-finance" },
  { code: "grok-legal",       zone: 4, tier: "PAID",    borderColor: TIER_COLORS.PAID,    label: "grok-legal" },

  // Zone 5: Product & Growth (1)
  { code: "gpt-oss-20b",      zone: 5, tier: "FREE",    borderColor: TIER_COLORS.FREE,    label: "gpt-oss-20b" },

  // Zone 6: AI Ops (3)
  { code: "gpt-oss",          zone: 6, tier: "FREE",    borderColor: TIER_COLORS.FREE,    label: "gpt-oss" },
  { code: "glm-tools",        zone: 6, tier: "FREE",    borderColor: TIER_COLORS.FREE,    label: "glm-tools" },
  { code: "nemotron-security", zone: 6, tier: "FREE",   borderColor: TIER_COLORS.FREE,    label: "nemotron-security" },

  // Zone 7: Strategy (2)
  { code: "gemini-flash",     zone: 7, tier: "PAID",    borderColor: TIER_COLORS.PAID,    label: "gemini-flash" },
  { code: "stepfun",          zone: 7, tier: "FREE",    borderColor: TIER_COLORS.FREE,    label: "stepfun" },

  // Zone 8: Comms & Lang (3)
  { code: "llama-translate",   zone: 8, tier: "FREE",   borderColor: TIER_COLORS.FREE,    label: "llama-translate" },
  { code: "local-text",       zone: 8, tier: "LOCAL",   borderColor: TIER_COLORS.LOCAL,   label: "local-text" },
  { code: "gemma-12b",        zone: 8, tier: "FREE",    borderColor: TIER_COLORS.FREE,    label: "gemma-12b" },

  // Zone 9: Workhorse (2)
  { code: "qwen-general",     zone: 9, tier: "FREE",    borderColor: TIER_COLORS.FREE,    label: "qwen-general" },
  { code: "gemini-lite",      zone: 9, tier: "PAID",    borderColor: TIER_COLORS.PAID,    label: "gemini-lite" },
];

/**
 * Computes initial (x, y) positions for all sprites within their
 * zones. Distributes agents evenly in a grid within the zone rect.
 */
export function computeSpritePositions(): Array<
  AgentSpriteConfig & { x: number; y: number }
> {
  const byZone = new Map<number, AgentSpriteConfig[]>();
  for (const a of AGENT_SPRITES) {
    const list = byZone.get(a.zone) ?? [];
    list.push(a);
    byZone.set(a.zone, list);
  }

  const result: Array<AgentSpriteConfig & { x: number; y: number }> = [];

  for (const zone of ZONES) {
    const agents = byZone.get(zone.id) ?? [];
    const count = agents.length;
    if (count === 0) continue;

    // Grid layout inside the zone
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cellW = zone.w / cols;
    const cellH = zone.h / rows;

    agents.forEach((agent, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      result.push({
        ...agent,
        x: zone.x + col * cellW + cellW / 2,
        y: zone.y + row * cellH + cellH / 2 + 8, // offset for zone label
      });
    });
  }

  return result;
}
