CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id VARCHAR(80) NOT NULL,
  sender VARCHAR(40) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dm_thread ON direct_messages(thread_id, created_at DESC);
ALTER TABLE direct_messages DISABLE ROW LEVEL SECURITY;
