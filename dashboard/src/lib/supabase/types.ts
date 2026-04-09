/**
 * Supabase Database types — Bloque 3 FASE 1
 *
 * Hand-written to match `supabase/migrations/20260409120000_initial_schema.sql`.
 * Regenerate from the live project once the migration is applied:
 *
 *     npx supabase gen types typescript --linked > src/lib/supabase/types.ts
 *
 * Until then this file is the source of truth for type checking. Keep it in
 * sync with the migration by hand.
 */

export type WorldState = "idle" | "walking" | "talking" | "active";

export type ConvStatus = "active" | "completed" | "interrupted";
export type ConvTrigger = "heartbeat" | "whatsapp" | "manual" | "ghost";

export type MsgRole = "agent_a" | "agent_b" | "javier";

export type TaskType = "todo" | "decision" | "followup" | "deploy" | "alert";
export type TaskPriority = "P0" | "P1" | "P2" | "P3";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type WorldEventType =
  | "agent_move"
  | "conversation_start"
  | "conversation_end"
  | "ghost_join"
  | "ghost_leave"
  | "agent_state_change";

export interface AgentPosition {
  code: string;
  division: number | null;
  world_x: number;
  world_y: number;
  world_target_x: number;
  world_target_y: number;
  world_state: WorldState;
  last_seen_at: string;
}

export interface ConvLog {
  id: string;
  openclaw_session_id: string | null;
  agent_a_code: string | null;
  agent_b_code: string | null;
  trigger_type: ConvTrigger | null;
  trigger_context: string | null;
  status: ConvStatus;
  total_tokens: number;
  total_cost: number;
  summary: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface MsgLog {
  id: string;
  conv_id: string;
  speaker: string;
  role: MsgRole;
  content: string;
  model_used: string | null;
  tokens_in: number;
  tokens_out: number;
  cost: number;
  latency_ms: number | null;
  created_at: string;
}

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
}

export interface CostsLog {
  id: string;
  date: string;
  agent_code: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost: number;
  request_count: number;
  error_count: number;
}

export interface WorldEvent {
  id: string;
  event_type: WorldEventType;
  payload: Record<string, unknown>;
  created_at: string;
}

/**
 * Supabase client generic type — passed as `Database` to `createClient<Database>()`.
 * Minimal shape: rows only, no views, no functions, no enums (those live as TS
 * unions above). When we run `supabase gen types`, this will be replaced with
 * the fully-typed Database shape that Supabase generates.
 */
export interface Database {
  public: {
    Tables: {
      agent_positions: {
        Row: AgentPosition;
        Insert: Partial<AgentPosition> & Pick<AgentPosition, "code">;
        Update: Partial<AgentPosition>;
      };
      conv_log: {
        Row: ConvLog;
        Insert: Partial<ConvLog>;
        Update: Partial<ConvLog>;
      };
      msg_log: {
        Row: MsgLog;
        Insert: Partial<MsgLog> & Pick<MsgLog, "conv_id" | "speaker" | "role" | "content">;
        Update: Partial<MsgLog>;
      };
      tasks: {
        Row: Task;
        Insert: Partial<Task> & Pick<Task, "type" | "priority" | "title">;
        Update: Partial<Task>;
      };
      costs_log: {
        Row: CostsLog;
        Insert: Partial<CostsLog> & Pick<CostsLog, "date" | "agent_code" | "model">;
        Update: Partial<CostsLog>;
      };
      world_events: {
        Row: WorldEvent;
        Insert: Partial<WorldEvent> & Pick<WorldEvent, "event_type" | "payload">;
        Update: Partial<WorldEvent>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
