"use client";
import { Archive, ArchiveRestore, Loader2, PartyPopper, Plus, Receipt, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { useLocalAccount } from "@/lib/use-local-account";
import { readApiError } from "@/lib/utils";

interface TripRow {
  id: string;
  title: string;
  tripDate: string | null;
  status: "active" | "archived";
  receipts: number;
  createdAt: string;
  updatedAt: string;
}

export function LocalDashboard() {
  const router = useRouter();
  const welcome = useSearchParams().get("welcome");
  const { user, loading } = useLocalAccount();
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/local-trips", { cache: "no-store" });
    if (res.ok) setTrips(((await res.json()) as { trips: TripRow[] }).trips);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login?next=/dashboard");
    else void load();
  }, [loading, user, router, load]);

  const newTrip = async () => {
    setCreating(true);
    setError(null);
    const res = await fetch("/api/local-trips", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    if (!res.ok) {
      setError((await readApiError(res)).message);
      setCreating(false);
      return;
    }
    const { id } = (await res.json()) as { id: string };
    router.push(`/trip/${id}`);
  };

  const setStatus = async (id: string, status: TripRow["status"]) => {
    await fetch(`/api/local-trips/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    void load();
  };
  const remove = async (t: TripRow) => {
    if (!window.confirm(`Delete “${t.title}”? This can't be undone.`)) return;
    await fetch(`/api/local-trips/${t.id}`, { method: "DELETE" });
    void load();
  };

  if (loading || !user || trips === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-lg font-bold">
            CoupleTab
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-300 sm:inline">{user.email}</span>
            <button className="text-slate-300 hover:text-white" onClick={() => fetch("/api/account/logout", { method: "POST" }).then(() => window.location.assign("/"))}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        {welcome && (
          <Card className="flex items-start gap-3 border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <PartyPopper className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <b>Welcome to CoupleTab, {user.name.split(" ")[0]}!</b> Start a trip tab, add the couples and singles at the table, then drop in your receipts.
            </div>
          </Card>
        )}
        <section>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">My trip tabs</h1>
            <Button onClick={newTrip} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New trip
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {trips.map((t) => (
              <Card key={t.id} className={t.status === "archived" ? "p-4 opacity-60" : "p-4"}>
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/trip/${t.id}`} className="min-w-0">
                    <div className="truncate font-semibold hover:underline">{t.title || "Untitled trip"}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      {t.tripDate ?? new Date(t.createdAt).toLocaleDateString("en-AU")}
                      <span className="flex items-center gap-0.5">
                        <Receipt className="h-3 w-3" /> {t.receipts}
                      </span>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1">
                    {t.status === "archived" && <Badge>Archived</Badge>}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t.status === "active" ? "Archive" : "Restore"}
                      onClick={() => setStatus(t.id, t.status === "active" ? "archived" : "active")}
                    >
                      {t.status === "active" ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Delete trip" onClick={() => remove(t)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {trips.length === 0 && (
            <Card className="mt-4 p-8 text-center">
              <Receipt className="mx-auto h-8 w-8 text-blue-700" />
              <h2 className="mt-2 font-semibold">No trips yet</h2>
              <p className="mt-1 text-sm text-slate-500">Start a tab for your next weekend away and add your first receipt.</p>
              <Button className="mt-4" onClick={newTrip} disabled={creating}>
                <Plus className="h-4 w-4" /> Start my first trip
              </Button>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}
