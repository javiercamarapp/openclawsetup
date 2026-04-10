-- ═══════════════════════════════════════════════════════════════════════════
-- Bloque 3 · FASE 3 · RPC helper for conversation totals
-- ═══════════════════════════════════════════════════════════════════════════
-- Atomically bumps total_tokens and total_cost on a conv_log row.
-- Called by the OpenClaw event subscriber on each conversation.message
-- event, so the conv_log row always reflects the running total without
-- a separate aggregation query.

CREATE OR REPLACE FUNCTION bump_conv_totals(
  p_conv_id UUID,
  p_tokens INT,
  p_cost NUMERIC
)
RETURNS VOID AS $$
BEGIN
  UPDATE conv_log SET
    total_tokens = total_tokens + p_tokens,
    total_cost = total_cost + p_cost
  WHERE id = p_conv_id;
END;
$$ LANGUAGE plpgsql;
