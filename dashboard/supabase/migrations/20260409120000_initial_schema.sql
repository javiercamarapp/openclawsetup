-- ═══════════════════════════════════════════════════════════════════════════
-- Bloque 3 · FASE 1 · Initial schema
-- ═══════════════════════════════════════════════════════════════════════════
-- Cache layer for the dashboard. OpenClaw gateway (ws://127.0.0.1:18789) is
-- the source of truth for agents, conversations, and costs. These tables
-- mirror events via the subscriber in FASE 3, EXCEPT `tasks` which is the
-- only table owned by the dashboard (OpenClaw has no task concept).
--
-- Table summary:
--   agent_positions  — pixel-world x/y per OpenClaw agent (25 rows)
--   conv_log         — cache of conversation metadata
--   msg_log          — cache of individual messages inside conversations
--   tasks            — dashboard-owned kanban (not cached)
--   costs_log        — snapshot of usage/cost per day/agent/model
--   world_events     — raw pixel-world events for replay/debug
--
-- RLS is disabled: this is a single-user dashboard running against a private
-- Supabase project. If multi-user ever becomes a thing, add policies here.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── AGENT POSITIONS ─────────────────────────────────────────────────────────
-- One row per OpenClaw agent (25 total after bloque-2 v3 topology).
-- `code` matches the agent id in ~/.openclaw/openclaw.json (e.g. "premium",
-- "grok-sales", "qwen-general"). `division` is the pixel-world zone (1..8)
-- and is nullable until the sync script in FASE 2 assigns it.
CREATE TABLE agent_positions (
  code             VARCHAR(40) PRIMARY KEY,
  division         INTEGER,
  world_x          DECIMAL(8,2) NOT NULL DEFAULT 0,
  world_y          DECIMAL(8,2) NOT NULL DEFAULT 0,
  world_target_x   DECIMAL(8,2) NOT NULL DEFAULT 0,
  world_target_y   DECIMAL(8,2) NOT NULL DEFAULT 0,
  world_state      VARCHAR(20)  NOT NULL DEFAULT 'idle',
  last_seen_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE agent_positions DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE agent_positions IS
  'Pixel-world coordinates for each OpenClaw agent. Synced from gateway in FASE 2.';
COMMENT ON COLUMN agent_positions.world_state IS
  'One of: idle | walking | talking | active';


-- ─── CONVERSATION LOG ────────────────────────────────────────────────────────
-- Cache of conversations happening in the gateway. Populated by the subscriber
-- (FASE 3) when it sees `conversation.started` / `conversation.completed`.
CREATE TABLE conv_log (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  openclaw_session_id  VARCHAR(64),
  agent_a_code         VARCHAR(40),
  agent_b_code         VARCHAR(40),
  trigger_type         VARCHAR(20),
  trigger_context      TEXT,
  status               VARCHAR(20) NOT NULL DEFAULT 'active',
  total_tokens         INTEGER     NOT NULL DEFAULT 0,
  total_cost           DECIMAL(10,6) NOT NULL DEFAULT 0,
  summary              TEXT,
  started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at             TIMESTAMPTZ
);

ALTER TABLE conv_log DISABLE ROW LEVEL SECURITY;

CREATE INDEX idx_conv_log_status     ON conv_log(status);
CREATE INDEX idx_conv_log_started_at ON conv_log(started_at DESC);
CREATE INDEX idx_conv_log_session    ON conv_log(openclaw_session_id);

COMMENT ON COLUMN conv_log.trigger_type IS
  'One of: heartbeat | whatsapp | manual | ghost';
COMMENT ON COLUMN conv_log.status IS
  'One of: active | completed | interrupted';


-- ─── MESSAGE LOG ─────────────────────────────────────────────────────────────
-- Individual messages within a conversation. Same subscriber that fills
-- conv_log fills this.
CREATE TABLE msg_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conv_id     UUID NOT NULL REFERENCES conv_log(id) ON DELETE CASCADE,
  speaker     VARCHAR(40) NOT NULL,
  role        VARCHAR(20) NOT NULL,
  content     TEXT NOT NULL,
  model_used  VARCHAR(100),
  tokens_in   INTEGER     NOT NULL DEFAULT 0,
  tokens_out  INTEGER     NOT NULL DEFAULT 0,
  cost        DECIMAL(10,6) NOT NULL DEFAULT 0,
  latency_ms  INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE msg_log DISABLE ROW LEVEL SECURITY;

CREATE INDEX idx_msg_log_conv       ON msg_log(conv_id);
CREATE INDEX idx_msg_log_created_at ON msg_log(created_at DESC);

COMMENT ON COLUMN msg_log.role IS
  'One of: agent_a | agent_b | javier (javier = ghost-mode operator message)';


-- ─── TASKS (dashboard-owned, not a cache) ────────────────────────────────────
-- This is the only table where the dashboard is the source of truth.
-- Tasks are derived from conversations (FASE 3 subscriber parses agent
-- outputs for explicit action items) or created manually in the UI.
CREATE TABLE tasks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conv_id              UUID REFERENCES conv_log(id),
  assigned_to_code     VARCHAR(40),
  assigned_to_javier   BOOLEAN     NOT NULL DEFAULT false,
  type                 VARCHAR(20) NOT NULL,
  priority             VARCHAR(5)  NOT NULL,
  title                VARCHAR(200) NOT NULL,
  description          TEXT,
  status               VARCHAR(20) NOT NULL DEFAULT 'pending',
  due_at               TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tasks_status   ON tasks(status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to_code);
CREATE INDEX idx_tasks_priority ON tasks(priority, status);
CREATE INDEX idx_tasks_due_at   ON tasks(due_at) WHERE due_at IS NOT NULL;

COMMENT ON COLUMN tasks.type     IS 'One of: todo | decision | followup | deploy | alert';
COMMENT ON COLUMN tasks.priority IS 'One of: P0 | P1 | P2 | P3';
COMMENT ON COLUMN tasks.status   IS 'One of: pending | in_progress | completed | cancelled';


-- ─── COSTS LOG ───────────────────────────────────────────────────────────────
-- Rolling snapshot of usage/cost. OpenClaw tracks cost per-call; we snapshot
-- aggregates here so the Cost Center screen can render without hammering the
-- gateway. One row per (date, agent, model) — upserted by the subscriber.
CREATE TABLE costs_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE NOT NULL,
  agent_code     VARCHAR(40) NOT NULL,
  model          VARCHAR(100) NOT NULL,
  tokens_in      BIGINT  NOT NULL DEFAULT 0,
  tokens_out     BIGINT  NOT NULL DEFAULT 0,
  cost           DECIMAL(10,6) NOT NULL DEFAULT 0,
  request_count  INTEGER NOT NULL DEFAULT 0,
  error_count    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (date, agent_code, model)
);

ALTER TABLE costs_log DISABLE ROW LEVEL SECURITY;

CREATE INDEX idx_costs_log_date       ON costs_log(date DESC);
CREATE INDEX idx_costs_log_agent_date ON costs_log(agent_code, date DESC);


-- ─── WORLD EVENTS (raw pixel-world event stream) ─────────────────────────────
-- Every event that affects the pixel world (agent_move, conversation_start,
-- ghost_join, etc.) gets appended here. Used for replay/debug and as the
-- Supabase Realtime source that the PixelWorld canvas subscribes to.
CREATE TABLE world_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  VARCHAR(30) NOT NULL,
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE world_events DISABLE ROW LEVEL SECURITY;

CREATE INDEX idx_world_events_created_at ON world_events(created_at DESC);
CREATE INDEX idx_world_events_type_time  ON world_events(event_type, created_at DESC);

COMMENT ON COLUMN world_events.event_type IS
  'One of: agent_move | conversation_start | conversation_end | ghost_join | ghost_leave | agent_state_change';
