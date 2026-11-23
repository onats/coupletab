"use client";
import { AlertTriangle, ArrowRight, Check, ChevronDown, Copy, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { colorFor } from "@/lib/colors";
import { money, round2 } from "@/lib/money";
import type { BillResult } from "@/lib/split";
import { buildSummary } from "@/lib/summary";
import type { TripState } from "@/lib/types";
import { cn, copyText } from "@/lib/utils";

export function BillPanel({ state, bill }: { state: TripState; bill: BillResult }) {
  const [copied, setCopied] = useState<string | null>(null);
  const flash = (k: string) => {
    setCopied(k);
    setTimeout(() => setCopied(null), 1500);
  };
  const summary = buildSummary(state, bill);
  const rates = [...new Set(state.receipts.filter((r) => !r.isDuplicate && r.surchargeRate > 0).map((r) => round2(r.surchargeRate * 100)))];
  const unitName = new Map(state.units.map((u) => [u.id, u.name]));
  const itemLabel = new Map(state.lineItems.map((i) => [i.id, i.label]));
  const memberName = new Map(state.members.map((m) => [m.id, m.name]));

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg font-semibold">2. Final bill per couple</h2>
          <p className="text-sm text-slate-500">{rates.length ? `Includes proportional ${rates.join("% / ")}% surcharges` : "No surcharges"}</p>
        </div>
        <Button
          size="sm"
          onClick={async () => {
            if (await copyText(summary)) flash("summary");
          }}
        >
          {copied === "summary" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied === "summary" ? "Copied" : "Copy summary"}
        </Button>
      </div>

      {bill.unassigned.count > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          <span>
            {bill.unassigned.count} item{bill.unassigned.count === 1 ? "" : "s"} left unassigned
          </span>
          <span className="tabular">{money(bill.unassigned.amount)}</span>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {bill.units.map((b) => {
          const c = colorFor(b.unit.color);
          return (
            <div key={b.unit.id} className={cn("rounded-xl border border-l-4 border-slate-200 bg-slate-50/60 p-4", c.border)}>
              <div className="flex items-baseline justify-between border-b border-dashed border-slate-300 pb-2">
                <span className="font-semibold">{b.unit.name}</span>
                <span className="tabular text-xl font-bold">{money(b.total)}</span>
              </div>
              <dl className="tabular mt-2 space-y-1 text-sm text-slate-600">
                {b.wholeSubtotal !== 0 && (
                  <Row label={b.unit.kind === "couple" ? "Shared as couple (whole)" : "Items subtotal"} value={b.wholeSubtotal} />
                )}
                {b.memberSubtotals
                  .filter((m) => m.amount !== 0)
                  .map((m) => (
                    <Row key={m.memberId} label={`${m.name} (individual)`} value={m.amount} />
                  ))}
                <Row label="Proportional surcharge" value={b.surcharge} />
                {b.paid > 0 && <Row label="Paid at the till (assigned items)" value={b.paid} muted />}
              </dl>
              {b.claims.length > 0 && (
                <details className="group mt-2 border-t border-slate-200 pt-2">
                  <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-blue-700">
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    View {b.claims.length} claimed item{b.claims.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="tabular mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-600">
                    {b.claims.map((cl, i) => (
                      <li key={`${cl.lineItemId}-${i}`}>
                        {itemLabel.get(cl.lineItemId)} ({cl.via === "unit" ? (b.unit.kind === "couple" ? "Couple" : "Whole") : memberName.get(cl.via)}
                        {cl.shares > 1 ? `, 1/${cl.shares}` : ""}): {money(cl.amount)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <h3 className="font-semibold">3. Who owes whom</h3>
        {bill.receiptsMissingPayer > 0 && (
          <p className="mt-2 flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Pick who paid for {bill.receiptsMissingPayer} receipt{bill.receiptsMissingPayer === 1 ? "" : "s"} to include {bill.receiptsMissingPayer === 1 ? "it" : "them"} in the settlement.
          </p>
        )}
        {bill.unassigned.count > 0 && bill.transfers.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">Provisional: unassigned items are treated as the payer&apos;s own until someone claims them.</p>
        )}
        <ul className="mt-3 space-y-2">
          {bill.transfers.map((t) => {
            const pid = state.units.find((u) => u.id === t.toUnitId)?.payid;
            const key = `${t.fromUnitId}-${t.toUnitId}`;
            return (
              <li key={key} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{unitName.get(t.fromUnitId)}</span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                  <span className="font-semibold">{unitName.get(t.toUnitId)}</span>
                  <span className="tabular ml-auto text-base font-bold">{money(t.amount)}</span>
                </div>
                {pid && (
                  <button
                    className="mt-2 flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100"
                    onClick={async () => {
                      if (await copyText(pid)) flash(key);
                    }}
                  >
                    <span className="truncate">PayID / BSB: {pid}</span>
                    {copied === key ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
              </li>
            );
          })}
          {bill.transfers.length === 0 && bill.receiptsMissingPayer === 0 && state.receipts.length > 0 && (
            <li className="text-sm text-emerald-700">All square, nobody owes anything.</li>
          )}
          {state.receipts.length === 0 && <li className="text-sm text-slate-500">Add a receipt to see who owes whom.</li>}
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              if (await copyText(summary)) flash("summary2");
            }}
          >
            {copied === "summary2" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied === "summary2" ? "Copied" : "Copy for iMessage"}
          </Button>
          <a
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
            href={`https://wa.me/?text=${encodeURIComponent(summary)}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", muted && "text-slate-400")}>
      <dt>{label}:</dt>
      <dd>{money(value)}</dd>
    </div>
  );
}
