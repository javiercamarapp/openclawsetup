#!/usr/bin/env node
/**
 * subscribe.ts — Bloque 3 FASE 3
 *
 * Long-running worker that connects to the OpenClaw gateway
 * WebSocket and streams events into Supabase.
 *
 * Usage (from `dashboard/`):
 *
 *   npm run subscribe
 *
 * or directly:
 *
 *   npx tsx --env-file=.env.local scripts/subscribe.ts
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL      — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY     — service role key (server-only)
 *   OPENCLAW_WS_URL               — gateway WS (default: ws://127.0.0.1:18789/events)
 *
 * The subscriber auto-reconnects with exponential backoff and
 * handles SIGINT/SIGTERM for graceful shutdown. It is safe to
 * run alongside the Next.js dev server.
 */

import { startOpenClawSubscriber } from "@/lib/gateway/ws-subscriber";

startOpenClawSubscriber();
