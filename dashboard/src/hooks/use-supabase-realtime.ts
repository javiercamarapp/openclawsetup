"use client";
/**
 * useSupabaseRealtime — Bloque 4 PHASE 1
 *
 * Generic hook wrapping a Supabase Realtime channel subscription.
 * Handles channel lifecycle on mount/unmount.
 */

import { useEffect, useRef } from "react";

import { getBrowserSupabase } from "@/lib/supabase/browser";

type PostgresEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface UseRealtimeOptions {
  table: string;
  event?: PostgresEvent;
  schema?: string;
  filter?: string;
  channelName?: string;
}

export function useSupabaseRealtime<T extends Record<string, unknown>>(
  options: UseRealtimeOptions,
  callback: (payload: { new: T; old: T; eventType: string }) => void,
) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const supabase = getBrowserSupabase();
    const channelName =
      options.channelName ?? `rt-${options.table}-${Date.now()}`;

    const channelConfig: {
      event: PostgresEvent;
      schema: string;
      table: string;
      filter?: string;
    } = {
      event: options.event ?? "*",
      schema: options.schema ?? "public",
      table: options.table,
    };

    if (options.filter) {
      channelConfig.filter = options.filter;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        channelConfig,
        (payload) => {
          callbackRef.current({
            new: payload.new as T,
            old: (payload.old ?? {}) as T,
            eventType: payload.eventType,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options.table, options.event, options.schema, options.filter, options.channelName]);
}
