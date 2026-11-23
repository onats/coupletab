"use client";
import { Crown, Loader2, Ticket, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { startCheckout } from "@/lib/use-account";

export function UpgradeDialog({ open, onClose, tripId, reason, returnTo }: { open: boolean; onClose: () => void; tripId?: string; reason?: string; returnTo: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;

  const buy = async (product: "trip_pass" | "pro") => {
    setBusy(product);
    setError(null);
    const r = await startCheckout(product, tripId);
    if (!r.ok) {
      setBusy(null);
      if (r.code === "needs_account" || r.code === "unauthorized") {
        router.push(`/login?next=${encodeURIComponent(returnTo)}&reason=upgrade`);
        return;
      }
      setError(r.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Unlock the whole weekend</h2>
            <p className="text-sm text-slate-500">{reason ?? "Unlimited receipt scans, saved groups and live table links."}</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {tripId && (
            <button
              className="rounded-xl border-2 border-blue-600 p-4 text-left hover:bg-blue-50 disabled:opacity-60"
              disabled={!!busy}
              onClick={() => buy("trip_pass")}
            >
              <Ticket className="h-5 w-5 text-blue-700" />
              <div className="mt-2 font-semibold">Weekend Trip Pass</div>
              <div className="text-2xl font-bold">
                $4.99 <span className="text-sm font-normal text-slate-500">AUD once</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">This trip: unlimited scans + live links for everyone at the table.</p>
              {busy === "trip_pass" && <Loader2 className="mt-2 h-4 w-4 animate-spin" />}
            </button>
          )}
          <button className="rounded-xl border border-slate-200 p-4 text-left hover:bg-slate-50 disabled:opacity-60" disabled={!!busy} onClick={() => buy("pro")}>
            <Crown className="h-5 w-5 text-amber-600" />
            <div className="mt-2 font-semibold">Pro Host</div>
            <div className="text-2xl font-bold">
              $9 <span className="text-sm font-normal text-slate-500">AUD / month</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Every trip unlocked, unlimited saved groups, cancel any time.</p>
            {busy === "pro" && <Loader2 className="mt-2 h-4 w-4 animate-spin" />}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <Button variant="ghost" className="mt-3 w-full" onClick={onClose}>
          Not now
        </Button>
      </div>
    </div>
  );
}
