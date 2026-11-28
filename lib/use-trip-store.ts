"use client";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { applyDiff, diffTrip, isEmptyDiff, loadTripBySlug, loadTripContents } from "./db";
import { getBrowserSupabase, getGuestSupabase } from "./supabase/client";
import { defaultTrip, tripReducer, type TripAction } from "./trip-reducer";
import type { LineItem, Receipt, TripState } from "./types";

export type StoreStatus = "loading" | "ready" | "not_found" | "error";

export interface TripStore {
  state: TripState | null;
  status: StoreStatus;
  error: string | null;
  syncing: boolean;
  live: boolean;
  dispatch: (a: TripAction) => void;
  /** Add a receipt that the server has already saved (skips writing it again). */
  addSavedReceipt: (receipt: Receipt, items: LineItem[]) => void;
  clearError: () => void;
  supabase: SupabaseClient | null;
}

const LOCAL_KEY = "coupletab:local-trip:v1";

/** Demo mode: everything lives in this browser's localStorage. */
export function useLocalTripStore(): TripStore {
  const [state, setState] = useState<TripState | null>(null);

  useEffect(() => {
    let initial: TripState | null = null;
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) initial = JSON.parse(raw) as TripState;
    } catch {
      initial = null;
    }
    setState(initial ?? defaultTrip({ title: "Weekend away" }));
  }, []);

  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: keep working in memory */
    }
  }, [state]);

  const dispatch = useCallback((a: TripAction) => setState((s) => (s ? tripReducer(s, a) : s)), []);
  const addSavedReceipt = useCallback(
    (receipt: Receipt, items: LineItem[]) => dispatch({ type: "receipt/add", receipt, items }),
    [dispatch],
  );
  return {
    state,
    status: state ? "ready" : "loading",
    error: null,
    syncing: false,
    live: false,
    dispatch,
    addSavedReceipt,
    clearError: () => {},
    supabase: null,
  };
}

/**
 * Supabase-backed store. Local edits apply instantly; a debounced flush diffs the last synced
 * snapshot against the current state and writes only what changed. Other phones at the table
 * are notified over a Realtime broadcast channel (plus postgres_changes for the host) and refetch.
 */
export function useRemoteTripStore(slug: string, joinToken: string | null): TripStore {
  const supabase = joinToken ? getGuestSupabase(joinToken) : getBrowserSupabase();
  const [state, setState] = useState<TripState | null>(null);
  const [status, setStatus] = useState<StoreStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [live, setLive] = useState(false);

  const current = useRef<TripState | null>(null);
  const synced = useRef<TripState | null>(null);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushing = useRef(false);
  const channel = useRef<RealtimeChannel | null>(null);

  const setBoth = useCallback((s: TripState) => {
    current.current = s;
    synced.current = s;
    setState(s);
  }, []);

  const hasPending = () =>
    flushing.current || !!flushTimer.current || (current.current && synced.current && !isEmptyDiff(diffTrip(synced.current, current.current)));

  const refresh = useCallback(async () => {
    if (!supabase || !current.current) return;
    if (hasPending()) {
      refreshTimer.current = setTimeout(refresh, 600);
      return;
    }
    try {
      const fresh = await loadTripContents(supabase, current.current.trip);
      if (!hasPending()) setBoth(fresh);
    } catch (e) {
      console.warn("refresh failed", e);
    }
  }, [supabase, setBoth]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(refresh, 250);
  }, [refresh]);

  const flush = useCallback(async () => {
    flushTimer.current = null;
    if (!supabase || !current.current || !synced.current) return;
    if (flushing.current) {
      flushTimer.current = setTimeout(flush, 200);
      return;
    }
    const target = current.current;
    const d = diffTrip(synced.current, target);
    if (isEmptyDiff(d)) return;
    flushing.current = true;
    setSyncing(true);
    try {
      await applyDiff(supabase, target.trip.id, d);
      synced.current = target;
      void channel.current?.send({ type: "broadcast", event: "changed", payload: {} });
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Save failed";
      setError(`Couldn't save your last change (${msg}). Reloaded the latest version.`);
      flushing.current = false;
      setSyncing(false);
      try {
        setBoth(await loadTripContents(supabase, target.trip));
      } catch {
        /* keep local state */
      }
      return;
    }
    flushing.current = false;
    setSyncing(false);
    if (current.current !== target) flushTimer.current = setTimeout(flush, 150);
  }, [supabase, setBoth]);

  useEffect(() => {
    if (!supabase) {
      setStatus("error");
      setError("Supabase is not configured");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const s = await loadTripBySlug(supabase, slug);
        if (cancelled) return;
        if (!s) {
          setStatus("not_found");
          return;
        }
        setBoth(s);
        setStatus("ready");

        const ch = supabase.channel(`trip:${s.trip.id}`, { config: { broadcast: { self: false } } });
        ch.on("broadcast", { event: "changed" }, scheduleRefresh);
        for (const table of ["item_assignments", "line_items", "receipts", "trip_units", "trip_members"]) {
          ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `trip_id=eq.${s.trip.id}` }, scheduleRefresh);
        }
        ch.subscribe((st) => setLive(st === "SUBSCRIBED"));
        channel.current = ch;
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "Could not load this trip");
      }
    })();
    return () => {
      cancelled = true;
      if (channel.current) void supabase.removeChannel(channel.current);
      channel.current = null;
    };
  }, [supabase, slug, setBoth, scheduleRefresh]);

  const dispatch = useCallback(
    (a: TripAction) => {
      if (!current.current) return;
      const next = tripReducer(current.current, a);
      current.current = next;
      setState(next);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(flush, a.type.startsWith("assign/") ? 50 : 400);
    },
    [flush],
  );

  const addSavedReceipt = useCallback((receipt: Receipt, items: LineItem[]) => {
    const add: TripAction = { type: "receipt/add", receipt, items };
    if (synced.current) synced.current = tripReducer(synced.current, add);
    if (current.current) {
      current.current = tripReducer(current.current, add);
      setState(current.current);
    }
    void channel.current?.send({ type: "broadcast", event: "changed", payload: {} });
  }, []);

  return { state, status, error, syncing, live, dispatch, addSavedReceipt, clearError: () => setError(null), supabase };
}

/**
 * Local accounts mode: the trip lives on this server (JSON file) and belongs to the signed-in
 * account. Edits apply instantly and the whole state is saved with a short debounce.
 */
export function useAccountTripStore(id: string): TripStore {
  const [state, setState] = useState<TripState | null>(null);
  const [status, setStatus] = useState<StoreStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const current = useRef<TripState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/local-trips/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (cancelled) return;
      if (res.status === 404 || res.status === 401) {
        setStatus("not_found");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        setError(`Could not load this trip (HTTP ${res.status})`);
        return;
      }
      const j = (await res.json()) as { state: TripState };
      current.current = j.state;
      setState(j.state);
      setStatus("ready");
    })().catch((e) => {
      if (cancelled) return;
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not load this trip");
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const save = useCallback(async () => {
    timer.current = null;
    if (!current.current) return;
    if (saving.current) {
      dirty.current = true;
      return;
    }
    saving.current = true;
    dirty.current = false;
    setSyncing(true);
    try {
      const res = await fetch(`/api/local-trips/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: current.current }),
      });
      if (!res.ok) setError(`Couldn't save your last change (HTTP ${res.status}).`);
    } catch {
      setError("Couldn't save your last change. Check the server is still running.");
    } finally {
      saving.current = false;
      setSyncing(false);
      if (dirty.current) void save();
    }
  }, [id]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 400);
  }, [save]);

  // Don't lose the last edit if the tab closes mid-debounce.
  useEffect(() => {
    const flush = () => {
      if (!timer.current || !current.current) return;
      clearTimeout(timer.current);
      timer.current = null;
      void fetch(`/api/local-trips/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: current.current }),
        keepalive: true,
      });
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [id]);

  const dispatch = useCallback(
    (a: TripAction) => {
      if (!current.current) return;
      current.current = tripReducer(current.current, a);
      setState(current.current);
      schedule();
    },
    [schedule],
  );
  const addSavedReceipt = useCallback((receipt: Receipt, items: LineItem[]) => dispatch({ type: "receipt/add", receipt, items }), [dispatch]);

  return { state, status, error, syncing, live: false, dispatch, addSavedReceipt, clearError: () => setError(null), supabase: null };
}
