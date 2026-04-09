/**
 * Browser-side Supabase client — Bloque 3 FASE 1
 *
 * Uses the anon key (safe to expose via NEXT_PUBLIC_*). Reads only.
 * Row Level Security is disabled on all tables in the initial migration,
 * so the anon key has effective full read access. Writes should go
 * through the server client (see ./server.ts) using the service role key.
 *
 * Usage:
 *
 *     "use client";
 *     import { getBrowserSupabase } from "@/lib/supabase/browser";
 *
 *     const supabase = getBrowserSupabase();
 *     const { data } = await supabase.from("agent_positions").select("*");
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let cached: SupabaseClient<Database> | null = null;

export function getBrowserSupabase(): SupabaseClient<Database> {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "[supabase/browser] Missing NEXT_PUBLIC_SUPABASE_URL or " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY. Check dashboard/.env.local."
    );
  }

  cached = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cached;
}
