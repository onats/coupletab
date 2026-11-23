"use client";
import { Camera, CloudOff, Loader2, Radio, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo } from "react";
import { money } from "@/lib/money";
import { computeBill, itemsFor } from "@/lib/split";
import { uid } from "@/lib/trip-reducer";
import type { TripStore } from "@/lib/use-trip-store";
import { BillPanel } from "./bill-panel";
import { GroupBar, type SavedGroupOption } from "./group-bar";
import { ReceiptCard } from "./receipt-card";
import { UploadZone } from "./upload-zone";
import { useUploader } from "./use-uploader";

export function Workspace({
  store,
  role,
  savedGroups,
  onSaveGroup,
  onScanLimit,
  scanHint,
  topSlot,
  onViewPhoto,
}: {
  store: TripStore;
  role: "local" | "owner" | "guest";
  savedGroups?: SavedGroupOption[];
  onSaveGroup?: () => void;
  onScanLimit?: (code: string) => void;
  scanHint?: React.ReactNode;
  topSlot?: React.ReactNode;
  onViewPhoto?: (path: string) => void;
}) {
  const { state, dispatch } = store;
  const canEdit = role !== "guest";
  const uploader = useUploader(store, { persisted: role === "owner", onLimit: onScanLimit });
  const bill = useMemo(() => (state ? computeBill(state) : null), [state]);

  const addManual = useCallback(() => {
    if (!state) return;
    const id = uid();
    dispatch({
      type: "receipt/add",
      receipt: {
        id,
        venueName: "New receipt",
        docType: "itemised_receipt",
        receiptNumber: null,
        referenceNumbers: [],
        dateTime: null,
        subtotal: null,
        surchargeRate: 0,
        surchargeAmount: null,
        surchargeLabel: null,
        taxIncluded: true,
        grandTotal: null,
        paidByUnitId: null,
        isDuplicate: false,
        duplicateOfId: null,
        duplicateReason: null,
        storagePath: null,
        sort: state.receipts.reduce((m, r) => Math.max(m, r.sort), -1) + 1,
      },
      items: [],
    });
    setTimeout(() => document.getElementById(`receipt-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }, [state, dispatch]);

  if (!state || !bill) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  const receipts = [...state.receipts].sort((a, b) => Number(a.isDuplicate) - Number(b.isDuplicate) || a.sort - b.sort);
  const units = [...state.units].sort((a, b) => a.sort - b.sort);

  return (
    <div className="pb-24 lg:pb-10">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Link href={role === "local" ? "/" : "/dashboard"} className="font-semibold text-slate-300 hover:text-white">
                CoupleTab
              </Link>
              {role === "local" && <span className="rounded bg-slate-700 px-1.5 py-0.5">Demo mode · saved in this browser</span>}
              {role === "guest" && <span className="rounded bg-slate-700 px-1.5 py-0.5">Joined as guest</span>}
              {role !== "local" &&
                (store.live ? (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Radio className="h-3 w-3" /> Live
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <CloudOff className="h-3 w-3" /> Offline
                  </span>
                ))}
              {store.syncing && <Loader2 className="h-3 w-3 animate-spin" />}
            </div>
            {canEdit ? (
              <input
                aria-label="Trip title"
                className="w-full truncate rounded bg-transparent text-xl font-bold hover:bg-slate-800 focus:bg-slate-800 focus:outline-none sm:text-2xl"
                value={state.trip.title}
                onChange={(e) => dispatch({ type: "trip/update", patch: { title: e.target.value } })}
              />
            ) : (
              <h1 className="truncate text-xl font-bold sm:text-2xl">{state.trip.title}</h1>
            )}
            <div className="flex flex-wrap items-center gap-x-2 text-sm text-slate-300">
              {canEdit ? (
                <input
                  type="date"
                  aria-label="Trip date"
                  className="rounded bg-transparent text-slate-300 [color-scheme:dark] focus:outline-none"
                  value={state.trip.tripDate ?? ""}
                  onChange={(e) => dispatch({ type: "trip/update", patch: { tripDate: e.target.value || null } })}
                />
              ) : (
                state.trip.tripDate && <span>{state.trip.tripDate}</span>
              )}
              <span>• Couple = 1 whole share • Partner shares roll up into their couple</span>
            </div>
          </div>
          <div className="tabular flex shrink-0 gap-2 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
              Receipts total: <b className="text-base">{money(bill.receiptsTotal)}</b>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
              Assigned: <b className="text-base">{money(bill.assignedTotal)}</b>
            </div>
          </div>
        </div>
      </header>

      {store.error && (
        <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6">
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <span className="flex-1">{store.error}</span>
            <button aria-label="Dismiss" onClick={store.clearError}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto mt-4 max-w-7xl space-y-4 px-4 sm:mt-6 sm:px-6">
        {topSlot}
        <GroupBar state={state} dispatch={dispatch} canEdit={canEdit} savedGroups={savedGroups} onSaveGroup={onSaveGroup} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
          <div className="space-y-4">
            {canEdit && (
              <UploadZone
                jobs={uploader.jobs}
                onFiles={uploader.addFiles}
                onDismiss={uploader.dismiss}
                onClear={uploader.clearFinished}
                onManual={addManual}
                hint={scanHint}
              />
            )}
            {receipts.map((r) => (
              <div key={r.id} id={`receipt-${r.id}`}>
                <ReceiptCard
                  receipt={r}
                  items={itemsFor(state.lineItems, r.id)}
                  units={units}
                  members={state.members}
                  assignments={state.assignments}
                  summary={bill.receipts[r.id]}
                  dispatch={dispatch}
                  canEdit={canEdit}
                  onViewPhoto={onViewPhoto}
                />
              </div>
            ))}
            {receipts.length === 0 && !canEdit && (
              <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">The host hasn&apos;t added any receipts yet.</p>
            )}
          </div>
          <div id="bill" className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <BillPanel state={state} bill={bill} />
          </div>
        </div>
      </main>

      {/* mobile: always-visible progress + jump to the bill */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="tabular mx-auto flex max-w-7xl items-center gap-3 text-sm">
          <div className="flex-1">
            {state.receipts.length === 0 ? (
              <span className="font-medium text-slate-700">No receipts yet</span>
            ) : bill.unassigned.count > 0 ? (
              <span className="font-medium text-amber-700">
                {bill.unassigned.count} unassigned · {money(bill.unassigned.amount)}
              </span>
            ) : (
              <span className="font-medium text-emerald-700">Everything assigned</span>
            )}
            <div className="text-xs text-slate-500">of {money(bill.receiptsTotal)}</div>
          </div>
          {canEdit && (
            <button
              className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 font-medium text-white"
              onClick={() => document.getElementById("receipt-camera-input")?.click()}
            >
              <Camera className="h-4 w-4" /> Scan
            </button>
          )}
          <a href="#bill" className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white">
            See bill
          </a>
        </div>
      </div>
    </div>
  );
}
