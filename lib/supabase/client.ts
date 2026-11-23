"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

let browser: SupabaseClient | null = null;

/** Cookie-backed client for signed-in users. Returns null in local demo mode. */
export function getBrowserSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  browser ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return browser;
}

const guestClients = new Map<string, SupabaseClient>();

/**
 * Client for people at the table who opened a share link. The join token travels in a header
 * that the RLS policies read via `request.headers`. Signed-in owners keep their session too.
 */
export function getGuestSupabase(joinToken: string): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  let c = guestClients.get(joinToken);
  if (!c) {
    c = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { "x-join-token": joinToken } }, isSingleton: false });
    guestClients.set(joinToken, c);
  }
  return c;
}
