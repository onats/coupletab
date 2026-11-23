import { round2 } from "./money";
import type { Assignment, LineItem, Receipt, TripState, Unit } from "./types";

export interface Claim {
  lineItemId: string;
  receiptId: string;
  label: string;
  /** Pre-surcharge amount this unit owes for the item. */
  amount: number;
  /** "unit" when claimed by the couple/single as a whole, otherwise the member id. */
  via: "unit" | string;
  shares: number;
}

export interface UnitBill {
  unit: Unit;
  /** Items shared by the unit as a whole (Couple (Whole) / Single). */
  wholeSubtotal: number;
  /** Per-partner individual overrides, rolled up into the unit. */
  memberSubtotals: { memberId: string; name: string; amount: number }[];
  itemsSubtotal: number;
  surcharge: number;
  total: number;
  /** What this unit paid at the till (credited only for assigned consumption). */
  paid: number;
  /** positive = is owed money, negative = owes money. */
  net: number;
  claims: Claim[];
}

export interface Transfer {
  fromUnitId: string;
  toUnitId: string;
  amount: number;
}

export interface ReceiptSummary {
  receiptId: string;
  itemsSubtotal: number;
  surcharge: number;
  total: number;
  assigned: number;
  unassignedCount: number;
  /** Set when OCR grand total disagrees with items + surcharge by more than 5c. */
  totalMismatch: number | null;
}

export interface BillResult {
  units: UnitBill[];
  receipts: Record<string, ReceiptSummary>;
  receiptsTotal: number;
  assignedTotal: number;
  unassigned: { count: number; amount: number };
  transfers: Transfer[];
  receiptsMissingPayer: number;
}

/** Normalise assignments for one item into concrete share-holders (each counts as 1 share). */
function holders(assignments: Assignment[], memberUnit: Map<string, string>, unitIds: Set<string>) {
  const seen = new Set<string>();
  const out: { unitId: string; via: "unit" | string }[] = [];
  for (const a of assignments) {
    const key = `${a.targetType}:${a.targetId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (a.targetType === "unit" && unitIds.has(a.targetId)) {
      out.push({ unitId: a.targetId, via: "unit" });
    } else if (a.targetType === "member") {
      const unitId = memberUnit.get(a.targetId);
      if (unitId) out.push({ unitId, via: a.targetId });
    }
  }
  return out;
}

export function surchargeFactor(r: Receipt): number {
  return Number.isFinite(r.surchargeRate) && r.surchargeRate > 0 ? r.surchargeRate : 0;
}

export function computeBill(state: TripState): BillResult {
  const { units, members, receipts, lineItems, assignments } = state;
  const unitIds = new Set(units.map((u) => u.id));
  const memberUnit = new Map(members.map((m) => [m.id, m.unitId]));
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const byItem = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const list = byItem.get(a.lineItemId) ?? [];
    list.push(a);
    byItem.set(a.lineItemId, list);
  }
  const activeReceipts = new Map(receipts.filter((r) => !r.isDuplicate).map((r) => [r.id, r]));

  const bills = new Map<string, UnitBill>(
    units.map((u) => [
      u.id,
      {
        unit: u,
        wholeSubtotal: 0,
        memberSubtotals: members
          .filter((m) => m.unitId === u.id)
          .sort((a, b) => a.sort - b.sort)
          .map((m) => ({ memberId: m.id, name: m.name, amount: 0 })),
        itemsSubtotal: 0,
        surcharge: 0,
        total: 0,
        paid: 0,
        net: 0,
        claims: [],
      },
    ]),
  );

  // consumption per unit, only on receipts that have a payer (for settlement)
  const settledConsumption = new Map<string, number>();
  const credit = new Map<string, number>();
  const summaries: Record<string, ReceiptSummary> = {};
  let unassignedCount = 0;
  let unassignedAmount = 0;

  for (const r of activeReceipts.values()) {
    summaries[r.id] = {
      receiptId: r.id,
      itemsSubtotal: 0,
      surcharge: 0,
      total: 0,
      assigned: 0,
      unassignedCount: 0,
      totalMismatch: null,
    };
  }

  const sortedItems = [...lineItems].sort((a, b) => a.sort - b.sort);
  for (const item of sortedItems) {
    const r = activeReceipts.get(item.receiptId);
    if (!r) continue;
    const factor = surchargeFactor(r);
    const s = summaries[r.id];
    s.itemsSubtotal += item.price;
    const hs = holders(byItem.get(item.id) ?? [], memberUnit, unitIds);
    if (hs.length === 0) {
      unassignedCount += 1;
      unassignedAmount += item.price * (1 + factor);
      s.unassignedCount += 1;
      continue;
    }
    const share = item.price / hs.length;
    s.assigned += item.price * (1 + factor);
    for (const h of hs) {
      const bill = bills.get(h.unitId)!;
      bill.claims.push({ lineItemId: item.id, receiptId: r.id, label: item.label, amount: share, via: h.via, shares: hs.length });
      if (h.via === "unit") bill.wholeSubtotal += share;
      else {
        const ms = bill.memberSubtotals.find((m) => m.memberId === h.via);
        if (ms) ms.amount += share;
        else bill.memberSubtotals.push({ memberId: h.via, name: memberName.get(h.via) ?? "?", amount: share });
      }
      bill.itemsSubtotal += share;
      bill.surcharge += share * factor;
      if (r.paidByUnitId && unitIds.has(r.paidByUnitId)) {
        const cost = share * (1 + factor);
        settledConsumption.set(h.unitId, (settledConsumption.get(h.unitId) ?? 0) + cost);
        credit.set(r.paidByUnitId, (credit.get(r.paidByUnitId) ?? 0) + cost);
      }
    }
  }

  let receiptsTotal = 0;
  let receiptsMissingPayer = 0;
  for (const r of activeReceipts.values()) {
    const s = summaries[r.id];
    s.surcharge = round2(s.itemsSubtotal * surchargeFactor(r));
    s.itemsSubtotal = round2(s.itemsSubtotal);
    s.total = round2(s.itemsSubtotal + s.surcharge);
    s.assigned = round2(s.assigned);
    if (r.grandTotal != null && Math.abs(r.grandTotal - s.total) > 0.05) s.totalMismatch = round2(r.grandTotal - s.total);
    receiptsTotal += s.total;
    if (!r.paidByUnitId || !unitIds.has(r.paidByUnitId)) receiptsMissingPayer += 1;
  }

  const unitBills: UnitBill[] = [];
  for (const u of [...units].sort((a, b) => a.sort - b.sort)) {
    const b = bills.get(u.id)!;
    b.wholeSubtotal = round2(b.wholeSubtotal);
    b.memberSubtotals = b.memberSubtotals.map((m) => ({ ...m, amount: round2(m.amount) }));
    b.itemsSubtotal = round2(b.itemsSubtotal);
    b.surcharge = round2(b.surcharge);
    b.total = round2(b.itemsSubtotal + b.surcharge);
    b.paid = round2(credit.get(u.id) ?? 0);
    b.net = round2((credit.get(u.id) ?? 0) - (settledConsumption.get(u.id) ?? 0));
    unitBills.push(b);
  }

  const assignedTotal = round2(unitBills.reduce((acc, b) => acc + b.total, 0));

  return {
    units: unitBills,
    receipts: summaries,
    receiptsTotal: round2(receiptsTotal),
    assignedTotal,
    unassigned: { count: unassignedCount, amount: round2(unassignedAmount) },
    transfers: settle(unitBills.map((b) => ({ id: b.unit.id, net: b.net }))),
    receiptsMissingPayer,
  };
}

/**
 * Greedy min-cash-flow settlement: repeatedly match the largest debtor with the
 * largest creditor. Produces at most n-1 transfers.
 */
export function settle(balances: { id: string; net: number }[]): Transfer[] {
  const cents = balances.map((b) => ({ id: b.id, c: Math.round(b.net * 100) }));
  const creditors = cents.filter((b) => b.c > 0).sort((a, b) => b.c - a.c);
  const debtors = cents.filter((b) => b.c < 0).map((b) => ({ id: b.id, c: -b.c })).sort((a, b) => b.c - a.c);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].c, creditors[j].c);
    if (amt > 0) out.push({ fromUnitId: debtors[i].id, toUnitId: creditors[j].id, amount: amt / 100 });
    debtors[i].c -= amt;
    creditors[j].c -= amt;
    if (debtors[i].c === 0) i++;
    if (creditors[j].c === 0) j++;
  }
  return out;
}

/** Items of a receipt in display order. */
export const itemsFor = (items: LineItem[], receiptId: string) =>
  items.filter((i) => i.receiptId === receiptId).sort((a, b) => a.sort - b.sort);
