"use client";
import { useCallback, useEffect, useState } from "react";

export interface LocalAccountUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

/** Local accounts mode (no Supabase): who is signed in, via the server session cookie. */
export function useLocalAccount() {
  const [user, setUser] = useState<LocalAccountUser | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/account/me", { cache: "no-store" });
      const j = (await res.json()) as { user: LocalAccountUser | null };
      setUser(j.user);
    } catch {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const signOut = useCallback(async () => {
    await fetch("/api/account/logout", { method: "POST" });
    setUser(null);
  }, []);

  return { user, loading, reload, signOut };
}
