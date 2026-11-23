import { nextColor } from "./colors";
import { findDuplicate } from "./dedupe";
import type { NormalizedReceipt } from "./receipt-schema";
import type { Assignment, GroupPreset, LineItem, Member, Receipt, TargetType, TripMeta, TripState, Unit, UnitKind } from "./types";

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

export type TripAction =
  | { type: "replace"; state: TripState }
  | { type: "trip/update"; patch: Partial<Pick<TripMeta, "title" | "tripDate">> }
  | { type: "unit/add"; kind: UnitKind; name?: string; memberNames?: string[]; payid?: string | null }
  | { type: "unit/update"; id: string; patch: Partial<Pick<Unit, "name" | "payid" | "color">> }
  | { type: "unit/remove"; id: string }
  | { type: "member/update"; id: string; name: string }
  | { type: "group/load"; preset: GroupPreset[]; replace: boolean }
  | { type: "receipt/add"; receipt: Receipt; items: LineItem[] }
  | { type: "receipt/update"; id: string; patch: Partial<Receipt> }
  | { type: "receipt/remove"; id: string }
  | { type: "item/add"; receiptId: string; label: string; price: number }
  | { type: "item/update"; id: string; patch: Partial<Pick<LineItem, "label" | "price">> }
  | { type: "item/remove"; id: string }
  | { type: "assign/toggle"; lineItemId: string; targetType: TargetType; targetId: string }
  | { type: "assign/all"; lineItemId: string }
  | { type: "assign/clear"; lineItemId: string }
  | { type: "assign/reset" };

export function emptyTrip(meta?: Partial<TripMeta>): TripState {
  return {
    trip: { id: uid(), slug: "local", title: "Weekend away", tripDate: null, isUnlocked: true, ownerId: null, joinToken: null, ...meta },
    units: [],
    members: [],
    receipts: [],
    lineItems: [],
    assignments: [],
  };
}

export function makeUnit(state: Pick<TripState, "units">, kind: UnitKind, name?: string, memberNames?: string[], payid?: string | null) {
  const n = state.units.filter((u) => u.kind === kind).length + 1;
  const unit: Unit = {
    id: uid(),
    kind,
    name: name ?? (kind === "couple" ? `Couple ${n}` : `Single ${n}`),
    color: nextColor(state.units.map((u) => u.color)),
    sort: state.units.reduce((m, u) => Math.max(m, u.sort), -1) + 1,
    payid: payid ?? null,
  };
  const names = memberNames ?? (kind === "couple" ? [`Partner A`, `Partner B`] : [unit.name]);
  const members: Member[] = (kind === "couple" ? names.slice(0, 2) : names.slice(0, 1)).map((m, i) => ({
    id: uid(),
    unitId: unit.id,
    name: m,
    sort: i,
  }));
  return { unit, members };
}

export function defaultTrip(meta?: Partial<TripMeta>): TripState {
  let s = emptyTrip(meta);
  s = tripReducer(s, { type: "unit/add", kind: "couple", memberNames: ["Partner 1A", "Partner 1B"] });
  s = tripReducer(s, { type: "unit/add", kind: "couple", memberNames: ["Partner 2A", "Partner 2B"] });
  return s;
}

/** Build state rows for a freshly parsed receipt, flagging duplicates against what is already in the trip. */
export function receiptFromParsed(state: Pick<TripState, "receipts">, parsed: NormalizedReceipt, opts?: { id?: string; storagePath?: string | null; paidByUnitId?: string | null }) {
  const id = opts?.id ?? uid();
  const dup = findDuplicate({ id, ...parsed }, state.receipts);
  const receipt: Receipt = {
    id,
    venueName: parsed.venueName,
    docType: parsed.docType,
    receiptNumber: parsed.receiptNumber,
    referenceNumbers: parsed.referenceNumbers,
    dateTime: parsed.dateTime,
    subtotal: parsed.subtotal,
    surchargeRate: parsed.surchargeRate,
    surchargeAmount: parsed.surchargeAmount,
    surchargeLabel: parsed.surchargeLabel,
    taxIncluded: parsed.taxIncluded,
    grandTotal: parsed.grandTotal,
    paidByUnitId: opts?.paidByUnitId ?? null,
    isDuplicate: !!dup,
    duplicateOfId: dup?.duplicateOfId ?? null,
    duplicateReason: dup?.reason ?? null,
    storagePath: opts?.storagePath ?? null,
    sort: state.receipts.reduce((m, r) => Math.max(m, r.sort), -1) + 1,
  };
  const items: LineItem[] = parsed.items.map((it, i) => ({
    id: uid(),
    receiptId: id,
    label: it.label,
    price: it.price,
    sourceLabel: it.sourceLabel,
    sort: i,
  }));
  return { receipt, items };
}

const without = (as: Assignment[], pred: (a: Assignment) => boolean) => as.filter((a) => !pred(a));

export function tripReducer(state: TripState, action: TripAction): TripState {
  switch (action.type) {
    case "replace":
      return action.state;
    case "trip/update":
      return { ...state, trip: { ...state.trip, ...action.patch } };
    case "unit/add": {
      const { unit, members } = makeUnit(state, action.kind, action.name, action.memberNames, action.payid);
      return { ...state, units: [...state.units, unit], members: [...state.members, ...members] };
    }
    case "unit/update":
      return { ...state, units: state.units.map((u) => (u.id === action.id ? { ...u, ...action.patch } : u)) };
    case "unit/remove": {
      const memberIds = new Set(state.members.filter((m) => m.unitId === action.id).map((m) => m.id));
      return {
        ...state,
        units: state.units.filter((u) => u.id !== action.id),
        members: state.members.filter((m) => m.unitId !== action.id),
        receipts: state.receipts.map((r) => (r.paidByUnitId === action.id ? { ...r, paidByUnitId: null } : r)),
        assignments: without(
          state.assignments,
          (a) => (a.targetType === "unit" && a.targetId === action.id) || (a.targetType === "member" && memberIds.has(a.targetId)),
        ),
      };
    }
    case "member/update":
      return { ...state, members: state.members.map((m) => (m.id === action.id ? { ...m, name: action.name } : m)) };
    case "group/load": {
      let s: TripState = action.replace
        ? state.units.reduce((acc, u) => tripReducer(acc, { type: "unit/remove", id: u.id }), state)
        : state;
      for (const p of action.preset) {
        s = tripReducer(s, { type: "unit/add", kind: p.kind, name: p.name, memberNames: p.members, payid: p.payid ?? null });
      }
      return s;
    }
    case "receipt/add":
      return { ...state, receipts: [...state.receipts, action.receipt], lineItems: [...state.lineItems, ...action.items] };
    case "receipt/update":
      return { ...state, receipts: state.receipts.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)) };
    case "receipt/remove": {
      const itemIds = new Set(state.lineItems.filter((i) => i.receiptId === action.id).map((i) => i.id));
      return {
        ...state,
        receipts: state.receipts
          .filter((r) => r.id !== action.id)
          .map((r) => (r.duplicateOfId === action.id ? { ...r, duplicateOfId: null } : r)),
        lineItems: state.lineItems.filter((i) => i.receiptId !== action.id),
        assignments: without(state.assignments, (a) => itemIds.has(a.lineItemId)),
      };
    }
    case "item/add": {
      const sort = state.lineItems.filter((i) => i.receiptId === action.receiptId).reduce((m, i) => Math.max(m, i.sort), -1) + 1;
      return {
        ...state,
        lineItems: [...state.lineItems, { id: uid(), receiptId: action.receiptId, label: action.label, price: action.price, sourceLabel: null, sort }],
      };
    }
    case "item/update":
      return { ...state, lineItems: state.lineItems.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i)) };
    case "item/remove":
      return {
        ...state,
        lineItems: state.lineItems.filter((i) => i.id !== action.id),
        assignments: without(state.assignments, (a) => a.lineItemId === action.id),
      };
    case "assign/toggle": {
      const { lineItemId, targetType, targetId } = action;
      const existing = state.assignments.find((a) => a.lineItemId === lineItemId && a.targetType === targetType && a.targetId === targetId);
      if (existing) return { ...state, assignments: state.assignments.filter((a) => a !== existing) };
      // Whole couple and its individual partners are mutually exclusive on one item,
      // otherwise the couple would silently pay for two shares.
      let next = state.assignments;
      if (targetType === "unit") {
        const memberIds = new Set(state.members.filter((m) => m.unitId === targetId).map((m) => m.id));
        next = without(next, (a) => a.lineItemId === lineItemId && a.targetType === "member" && memberIds.has(a.targetId));
      } else {
        const unitId = state.members.find((m) => m.id === targetId)?.unitId;
        next = without(next, (a) => a.lineItemId === lineItemId && a.targetType === "unit" && a.targetId === unitId);
      }
      return { ...state, assignments: [...next, { id: uid(), lineItemId, targetType, targetId }] };
    }
    case "assign/all": {
      const current = state.assignments.filter((a) => a.lineItemId === action.lineItemId);
      const allWhole =
        current.length === state.units.length && state.units.every((u) => current.some((a) => a.targetType === "unit" && a.targetId === u.id));
      const rest = without(state.assignments, (a) => a.lineItemId === action.lineItemId);
      if (allWhole) return { ...state, assignments: rest };
      return {
        ...state,
        assignments: [...rest, ...state.units.map((u) => ({ id: uid(), lineItemId: action.lineItemId, targetType: "unit" as const, targetId: u.id }))],
      };
    }
    case "assign/clear":
      return { ...state, assignments: without(state.assignments, (a) => a.lineItemId === action.lineItemId) };
    case "assign/reset":
      return { ...state, assignments: [] };
  }
}
