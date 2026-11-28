"use client";
import { Archive, ArchiveRestore, Crown, Loader2, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { LocalDashboard } from "@/components/local/dashboard";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { FREE_ACTIVE_TRIPS, FREE_SAVED_GROUPS, isPaid } from "@/lib/plans";
import type { GroupPreset } from "@/lib/types";
import { useAccount } from "@/lib/use-account";

interface TripRow {
  id: string;
  slug: string;
  title: string;
  trip_date: string | null;
  status: "active" | "archived";
  is_unlocked: boolean;
  created_at: string;
}
interface GroupRow {
  id: string;
  name: string;
  units: GroupPreset[];
}

const TIER_LABEL = { free: "Free", trip_pass: "Trip Pass", pro: "Pro Host" } as const;

function SupabaseDashboard() {
  const router = useRouter();
  const { sb, user, profile, isAnonymous, loading } = useAccount();
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const load = useCallback(async () => {
    if (!sb || !user) return;
    const [t, g] = await Promise.all([
      sb.from("trips").select("id, slug, title, trip_date, status, is_unlocked, created_at").eq("owner_id", user.id).order("created_at", { ascending: false }),
      sb.from("saved_groups").select("id, name, units").order("created_at", { ascending: false }),
    ]);
    setTrips((t.data as TripRow[]) ?? []);
    setGroups((g.data as GroupRow[]) ?? []);
  }, [sb, user]);

  useEffect(() => {
    if (!loading && sb && !user) router.replace("/login?next=/dashboard");
    void load();
  }, [loading, sb, user, router, load]);

  if (!sb) {
    return (
      <Card className="mx-auto mt-20 max-w-md p-6 text-center">
        <p className="text-sm text-slate-600">Accounts aren&apos;t configured. Demo mode keeps your tab in this browser.</p>
        <Link href="/local">
          <Button className="mt-4">Open demo mode</Button>
        </Link>
      </Card>
    );
  }
  if (loading || !user || trips === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  const tier = profile?.plan_tier ?? "free";
  const activeLocked = trips.filter((t) => t.status === "active" && !t.is_unlocked).length;
  const atTripLimit = tier !== "pro" && activeLocked >= FREE_ACTIVE_TRIPS;

  const setStatus = async (id: string, status: TripRow["status"]) => {
    await sb.from("trips").update({ status }).eq("id", id);
    void load();
  };
  const deleteGroup = async (id: string) => {
    if (!window.confirm("Delete this saved group?")) return;
    await sb.from("saved_groups").delete().eq("id", id);
    void load();
  };

  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-lg font-bold">
            CoupleTab
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Badge className="border-slate-600 bg-slate-800 text-slate-200">
              {tier === "pro" && <Crown className="h-3 w-3 text-amber-400" />}
              {TIER_LABEL[tier]}
            </Badge>
            <span className="hidden text-slate-300 sm:inline">{isAnonymous ? "Guest account" : user.email}</span>
            {isAnonymous ? (
              <Link href="/login?next=/dashboard" className="text-blue-300 hover:text-white">
                Add email
              </Link>
            ) : (
              <button className="text-slate-300 hover:text-white" onClick={() => sb.auth.signOut().then(() => router.push("/"))}>
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <section>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">My trip tabs</h1>
            <Button onClick={() => (atTripLimit ? setUpgradeOpen(true) : router.push("/new"))}>
              <Plus className="h-4 w-4" /> New trip
            </Button>
          </div>
          {atTripLimit && (
            <p className="mt-2 text-sm text-slate-500">
              The free plan has {FREE_ACTIVE_TRIPS} active trip. Archive your current one or go Pro for unlimited.
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {trips.map((t) => (
              <Card key={t.id} className={t.status === "archived" ? "p-4 opacity-60" : "p-4"}>
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/trip/${t.slug}`} className="min-w-0">
                    <div className="truncate font-semibold hover:underline">{t.title}</div>
                    <div className="text-xs text-slate-500">{t.trip_date ?? new Date(t.created_at).toLocaleDateString("en-AU")}</div>
                  </Link>
                  <div className="flex items-center gap-1">
                    {t.is_unlocked && <Badge className="border-blue-200 bg-blue-50 text-blue-700">Unlocked</Badge>}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t.status === "active" ? "Archive" : "Restore"}
                      onClick={() => setStatus(t.id, t.status === "active" ? "archived" : "active")}
                    >
                      {t.status === "active" ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {trips.length === 0 && <p className="text-sm text-slate-500">No trips yet. Start one and add your first receipt.</p>}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold">My Regulars</h2>
          <p className="text-sm text-slate-500">
            Couples and singles you travel with. Save one from any trip with “Save group”.
            {!isPaid(tier) && ` Free plan: ${FREE_SAVED_GROUPS} saved group.`}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {groups.map((g) => (
              <Card key={g.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 font-semibold">
                      <Users className="h-4 w-4" /> {g.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {g.units.map((u) => (u.kind === "couple" ? `${u.members.join(" & ")}` : u.members[0] ?? u.name)).join(" · ")}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={atTripLimit} onClick={() => router.push(`/new?group=${g.id}`)}>
                      New trip
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Delete group" onClick={() => deleteGroup(g.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {groups.length === 0 && <p className="text-sm text-slate-500">Nothing saved yet.</p>}
          </div>
        </section>

        {tier !== "pro" && (
          <Card className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center">
            <Crown className="h-6 w-6 text-amber-500" />
            <div className="flex-1">
              <div className="font-semibold">Pro Host · $9/month</div>
              <p className="text-sm text-slate-500">Unlimited trips, receipts and saved groups, plus live table links on every trip.</p>
            </div>
            <Button onClick={() => setUpgradeOpen(true)}>Upgrade</Button>
          </Card>
        )}
      </main>
      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} returnTo="/dashboard" />
    </div>
  );
}

export default function Dashboard() {
  if (!getBrowserSupabase()) {
    return (
      <Suspense>
        <LocalDashboard />
      </Suspense>
    );
  }
  return <SupabaseDashboard />;
}
