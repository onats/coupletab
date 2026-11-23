"use client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { readApiError } from "@/lib/utils";

function NewTrip() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const sb = getBrowserSupabase();
    if (!sb) {
      router.replace("/local");
      return;
    }
    (async () => {
      const { data } = await sb.auth.getUser();
      if (!data.user) {
        // Zero-friction start: an anonymous account that can be upgraded with an email later.
        const { error: anonErr } = await sb.auth.signInAnonymously();
        if (anonErr) {
          router.replace(`/login?next=/new`);
          return;
        }
      }
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ savedGroupId: params.get("group") ?? undefined }),
      });
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }
      const { slug } = (await res.json()) as { slug: string };
      router.replace(`/trip/${slug}`);
    })();
  }, [router, params]);

  if (error) {
    return (
      <Card className="mx-auto mt-20 max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">{error.code === "trip_limit" ? "You already have an active trip" : "Couldn't start a trip"}</h1>
        <p className="mt-2 text-sm text-slate-600">{error.message}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/dashboard">
            <Button variant="outline">Go to my trips</Button>
          </Link>
          <Link href="/local">
            <Button variant="ghost">Use demo mode</Button>
          </Link>
        </div>
      </Card>
    );
  }
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Setting up your tab…
    </div>
  );
}

export default function NewTripPage() {
  return (
    <Suspense>
      <NewTrip />
    </Suspense>
  );
}
