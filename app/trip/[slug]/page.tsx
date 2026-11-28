"use client";
import { Check, Copy, Link2, Lock, Loader2, Share2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { LocalTrip } from "@/components/local/trip";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SavedGroupOption } from "@/components/workspace/group-bar";
import { Workspace } from "@/components/workspace/workspace";
import { FREE_SCANS_PER_TRIP } from "@/lib/plans";
import type { GroupPreset } from "@/lib/types";
import { useAccount } from "@/lib/use-account";
import { useRemoteTripStore } from "@/lib/use-trip-store";
import { copyText } from "@/lib/utils";

function TripRoom() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearchParams();
  const token = search.get("t");
  const upgraded = search.get("upgraded");
  const store = useRemoteTripStore(slug, token);
  const { sb, user, profile, isAnonymous, loading: accountLoading } = useAccount();
  const [savedGroups, setSavedGroups] = useState<SavedGroupOption[]>([]);
  const [upgrade, setUpgrade] = useState<{ open: boolean; reason?: string }>({ open: false });
  const [notice, setNotice] = useState<string | null>(upgraded ? "Payment received. Unlocking your trip…" : null);

  const state = store.state;
  const isOwner = !!user && !!state && state.trip.ownerId === user.id;
  const isPro = profile?.plan_tier === "pro";
  const unlocked = !!state && (state.trip.isUnlocked || isPro);

  // Stripe webhooks land a moment after the redirect: reload once to pick up the unlock.
  useEffect(() => {
    if (!upgraded) return;
    const t = setTimeout(() => window.location.replace(`/trip/${slug}`), 4000);
    return () => clearTimeout(t);
  }, [upgraded, slug]);

  const loadGroups = useCallback(async () => {
    if (!sb || !user || isAnonymous) return;
    const { data } = await sb.from("saved_groups").select("id, name, units").order("created_at", { ascending: false });
    setSavedGroups((data ?? []).map((g) => ({ id: g.id as string, name: g.name as string, units: g.units as GroupPreset[] })));
  }, [sb, user, isAnonymous]);
  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const saveGroup = useCallback(async () => {
    if (!sb || !user || !state) return;
    if (isAnonymous) {
      setNotice("Add your email (top of the page) to save groups you travel with often.");
      return;
    }
    const name = window.prompt("Name this group (e.g. 'Hunter Valley crew')", state.trip.title);
    if (!name?.trim()) return;
    const units: GroupPreset[] = [...state.units]
      .sort((a, b) => a.sort - b.sort)
      .map((u) => ({
        kind: u.kind,
        name: u.name,
        payid: u.payid,
        members: state.members.filter((m) => m.unitId === u.id).sort((a, b) => a.sort - b.sort).map((m) => m.name),
      }));
    const { error } = await sb.from("saved_groups").insert({ owner_id: user.id, name: name.trim(), units });
    if (error) {
      if (error.code === "42501") setUpgrade({ open: true, reason: "The free plan keeps one saved group. Upgrade for unlimited “My Regulars”." });
      else setNotice(`Couldn't save the group: ${error.message}`);
      return;
    }
    setNotice(`Saved “${name.trim()}” to My Regulars.`);
    void loadGroups();
  }, [sb, user, state, isAnonymous, loadGroups]);

  const viewPhoto = useCallback(
    async (path: string) => {
      if (!sb) return;
      const { data, error } = await sb.storage.from("receipts").createSignedUrl(path, 300);
      if (error || !data) setNotice("Couldn't open the photo.");
      else window.open(data.signedUrl, "_blank", "noopener");
    },
    [sb],
  );

  if (store.status === "not_found" || (store.status === "error" && !state)) {
    return (
      <Card className="mx-auto mt-20 max-w-md p-6 text-center">
        <Lock className="mx-auto h-8 w-8 text-slate-400" />
        <h1 className="mt-2 text-lg font-semibold">{store.status === "not_found" ? "This tab is private" : "Couldn't open this tab"}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {store.status === "not_found"
            ? token
              ? "This table link isn't active. The host needs a Trip Pass or Pro to share live links."
              : "Ask the host for the table link, or sign in if it's yours."
            : store.error}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href={`/login?next=/trip/${slug}`}>
            <Button variant="outline">Sign in</Button>
          </Link>
          <Link href="/">
            <Button variant="ghost">Home</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const role = isOwner ? "owner" : "guest";
  const shareUrl = state?.trip.joinToken && typeof window !== "undefined" ? `${window.location.origin}/trip/${slug}?t=${state.trip.joinToken}` : null;

  const topSlot =
    state && !accountLoading ? (
      <div className="space-y-3">
        {notice && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <span>{notice}</span>
            <button className="text-blue-700" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </div>
        )}
        {isOwner && isAnonymous && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <span className="text-slate-600">You&apos;re using CoupleTab without an account. Add your email to keep this tab and find it on any device.</span>
            <Link href={`/login?next=/trip/${slug}`}>
              <Button size="sm" variant="outline">
                Save my tab
              </Button>
            </Link>
          </div>
        )}
        {isOwner && (
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="flex items-center gap-2 font-semibold">
                <Link2 className="h-4 w-4" /> Invite the table
              </div>
              <p className="text-sm text-slate-500">
                {unlocked
                  ? "Anyone with this link can tap their own chips live on their phone. No sign-up needed."
                  : "Let everyone tap their own items live from their phone. Included with a Trip Pass or Pro."}
              </p>
            </div>
            {unlocked && shareUrl ? (
              <ShareButtons url={shareUrl} title={state.trip.title} />
            ) : (
              <Button onClick={() => setUpgrade({ open: true })}>
                <Sparkles className="h-4 w-4" /> Unlock for $4.99
              </Button>
            )}
          </Card>
        )}
      </div>
    ) : null;

  return (
    <>
      <Workspace
        store={store}
        role={role}
        savedGroups={isOwner ? savedGroups : undefined}
        onSaveGroup={isOwner ? saveGroup : undefined}
        onViewPhoto={isOwner ? viewPhoto : undefined}
        onScanLimit={(code) =>
          code === "scan_limit"
            ? setUpgrade({ open: true, reason: `Free trips include ${FREE_SCANS_PER_TRIP} AI receipt scans. Unlock this trip to scan the rest.` })
            : undefined
        }
        scanHint={
          isOwner && !unlocked ? (
            <span>
              Free trip: {FREE_SCANS_PER_TRIP} AI scans included.{" "}
              <button className="font-medium text-blue-700 underline" onClick={() => setUpgrade({ open: true })}>
                Unlock unlimited
              </button>
            </span>
          ) : undefined
        }
        topSlot={topSlot}
      />
      {state && <UpgradeDialog open={upgrade.open} reason={upgrade.reason} tripId={isOwner ? state.trip.id : undefined} returnTo={`/trip/${slug}`} onClose={() => setUpgrade({ open: false })} />}
    </>
  );
}

function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={async () => {
          if (await copyText(url)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy link"}
      </Button>
      {canShare && (
        <Button onClick={() => navigator.share({ title: `${title} · CoupleTab`, text: "Tap what you had:", url }).catch(() => {})}>
          <Share2 className="h-4 w-4" /> Share
        </Button>
      )}
    </div>
  );
}

export default function TripPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      }
    >
      {getBrowserSupabase() ? <TripRoom /> : <LocalTripRoute />}
    </Suspense>
  );
}

function LocalTripRoute() {
  const { slug } = useParams<{ slug: string }>();
  return <LocalTrip id={slug} />;
}
