"use client";
import { Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Workspace } from "@/components/workspace/workspace";
import { useAccountTripStore } from "@/lib/use-trip-store";

export function LocalTrip({ id }: { id: string }) {
  const store = useAccountTripStore(id);
  if (store.status === "not_found" || (store.status === "error" && !store.state)) {
    return (
      <Card className="mx-auto mt-20 max-w-md p-6 text-center">
        <Lock className="mx-auto h-8 w-8 text-slate-400" />
        <h1 className="mt-2 text-lg font-semibold">{store.status === "not_found" ? "This tab is private" : "Couldn't open this tab"}</h1>
        <p className="mt-2 text-sm text-slate-600">{store.status === "not_found" ? "Log in with the account that created it." : store.error}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href={`/login?next=/trip/${id}`}>
            <Button variant="outline">Log in</Button>
          </Link>
          <Link href="/">
            <Button variant="ghost">Home</Button>
          </Link>
        </div>
      </Card>
    );
  }
  return (
    <Workspace
      store={store}
      role="account"
      topSlot={
        store.error ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <span>{store.error}</span>
            <button onClick={store.clearError}>Dismiss</button>
          </div>
        ) : null
      }
    />
  );
}
