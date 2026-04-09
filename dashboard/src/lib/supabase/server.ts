/**
 * Server-side Supabase client — Bloque 3 FASE 1
 *
 * Uses the service role key (server-only, NEVER expose to browser).
 * Use this client for:
 *   - Route handlers (`app/api/**\/route.ts`)
 *   - Server Components that need mutations
 *   - The FASE 3 subscriber worker that inserts into world_events / conv_log
 *
 * This file imports `process.env.SUPABASE_SERVICE_ROLE_KEY` which is only
 * defined on the server. Do NOT import this from "use client" files; if
 * you do, the build will fail at import time because the key will be
 * undefined in the browser bundle.
 *
 * Usage:
 *
 *     import { getServerSupabase } from "@/lib/supabase/server";
 *
 *     export async function GET() {
 *       const supabase = getServerSupabase();
 *       const { data } = await supabase.from("tasks").select("*");
 *       return Response.json(data);
 *     }
 */

// Note: we don't use `import "server-only"` because the package isn't
// installed as a top-level dep. Instead, we rely on the fact that
// SUPABASE_SERVICE_ROLE_KEY is a non-NEXT_PUBLIC env var, so Next.js
// will not include its value in the client bundle. If this file is
// imported from a client component, the createClient() call will throw
// at runtime because serviceRoleKey will be undefined.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let cached: SupabaseClient<Database> | null = null;

export function getServerSupabase(): SupabaseClient<Database> {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "[supabase/server] Missing NEXT_PUBLIC_SUPABASE_URL or " +
        "SUPABASE_SERVICE_ROLE_KEY. Check dashboard/.env.local."
    );
  }

  cached = createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cached;
}
