"use client";
import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "./supabase/client";
import type { PlanTier } from "./types";

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  plan_tier: PlanTier;
}

export function useAccount() {
  const sb = getBrowserSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(!!sb);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.auth.getUser();
    setUser(data.user);
    if (data.user) {
      const { data: p } = await sb.from("profiles").select("id, email, display_name, plan_tier").eq("id", data.user.id).maybeSingle();
      setProfile((p as Profile) ?? null);
    } else setProfile(null);
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    if (!sb) return;
    void load();
    const { data } = sb.auth.onAuthStateChange(() => void load());
    return () => data.subscription.unsubscribe();
  }, [sb, load]);

  return { sb, user, profile, loading, reload: load, isAnonymous: !!user?.is_anonymous };
}

export async function startCheckout(product: "trip_pass" | "pro", tripId?: string): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product, tripId }),
  });
  const j = (await res.json().catch(() => ({}))) as { url?: string; error?: { code: string; message: string } };
  if (res.ok && j.url) {
    window.location.href = j.url;
    return { ok: true };
  }
  return { ok: false, code: j.error?.code ?? "server_error", message: j.error?.message ?? "Checkout failed" };
}
