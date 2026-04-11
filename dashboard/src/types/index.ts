/**
 * Shared domain types — Bloque 4
 *
 * Central type definitions for the Empresa Virtual dashboard.
 * Used by Zustand stores, PixiJS components, API routes, and hooks.
 */

// ── Agent ───────────────────────────────────────────────────────

export type AgentState = "idle" | "walking" | "talking" | "active";

export type AgentTier = "LOCAL" | "FREE" | "PAID" | "PREMIUM";

export interface AgentSprite {
  code: string;
  zone: number;
  tier: AgentTier;
  borderColor: string;
  label: string;
  // Runtime state
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  worldState: AgentState;
  animFrame: number;
  currentActivity: string | null;
  conversationPartner: string | null;
  /** Timestamp of last target change for pathfinding */
  lastTargetChangeMs: number;
}

// ── Conversations ───────────────────────────────────────────────

export interface ConversationVisual {
  id: string;
  agentA: string;
  agentB: string | null;
  /** Speech bubble text for the currently speaking agent */
  speechText: string | null;
  /** Which agent is currently speaking */
  speaker: string | null;
  triggerType: string;
  startedAt: string;
  status: "active" | "completed" | "interrupted";
}

// ── Activity Feed ───────────────────────────────────────────────

export type ActivityEventType = "conversation" | "task" | "error" | "cron" | "info";

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  agentA: string;
  agentB: string | null;
  summary: string;
  cost: number;
  taskCount: number;
  timestamp: string;
  urgent: boolean;
}

// ── KPIs ────────────────────────────────────────────────────────

export interface KpiSnapshot {
  agentCount: number;
  activeCount: number;
  todayCost: number;
  openTasks: number;
  errorCount: number;
}

// ── Direct Chat ─────────────────────────────────────────────────

export interface DirectMessage {
  id: string;
  thread_id: string;
  sender: string; // "javier" or agent code
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ChatThread {
  agentCode: string;
  messages: DirectMessage[];
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
}

// ── Tasks ───────────────────────────────────────────────────────

export type TaskStatus = "pending" | "in_progress" | "waiting" | "completed" | "cancelled";
export type TaskPriority = "P0" | "P1" | "P2" | "P3";
export type TaskType = "todo" | "decision" | "followup" | "deploy" | "alert";

export interface Task {
  id: string;
  conv_id: string | null;
  assigned_to_code: string | null;
  assigned_to_javier: boolean;
  type: TaskType;
  priority: TaskPriority;
  title: string;
  description: string | null;
  status: TaskStatus;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  scheduled_at?: string | null;
  recurrence?: string | null;
}

export interface TaskFilters {
  priority: TaskPriority | null;
  division: string | null;
  agentCode: string | null;
  onlyMine: boolean;
}

// ── Costs ───────────────────────────────────────────────────────

export interface CostAggregation {
  date: string;
  agentCode: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  requestCount: number;
  errorCount: number;
}

export interface CostSummary {
  monthly: number;
  today: number;
  budgetUsedPct: number;
  projectedMonthly: number;
  monthlyChange: number; // % change vs last month
}

// ── World Events ────────────────────────────────────────────────

export type WorldEventType =
  | "conversation_start"
  | "conversation_end"
  | "agent_move"
  | "agent_error"
  | "ghost_join"
  | "ghost_leave"
  | "ghost_message"
  | "cron_start"
  | "cron_end"
  | "agent_state_change";

export interface WorldEvent {
  id: string;
  event_type: WorldEventType;
  payload: Record<string, unknown>;
  created_at: string;
}
