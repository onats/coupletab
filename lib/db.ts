import type { SupabaseClient } from "@supabase/supabase-js";
import type { Assignment, DocType, LineItem, Member, Receipt, TripMeta, TripState, Unit } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export const toTripMeta = (r: Row): TripMeta => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  tripDate: r.trip_date,
  isUnlocked: !!r.is_unlocked,
  ownerId: r.owner_id,
  joinToken: r.join_token ?? null,
});
export const toUnit = (r: Row): Unit => ({ id: r.id, kind: r.kind, name: r.name, color: r.color, sort: r.sort, payid: r.payid });
export const toMember = (r: Row): Member => ({ id: r.id, unitId: r.unit_id, name: r.name, sort: r.sort });
export const toReceipt = (r: Row): Receipt => ({
  id: r.id,
  venueName: r.venue_name,
  docType: r.doc_type as DocType,
  receiptNumber: r.receipt_number,
  referenceNumbers: r.reference_numbers ?? [],
  dateTime: r.date_time,
  subtotal: n(r.subtotal),
  surchargeRate: Number(r.surcharge_rate ?? 0),
  surchargeAmount: n(r.surcharge_amount),
  surchargeLabel: r.surcharge_label,
  taxIncluded: !!r.tax_included,
  grandTotal: n(r.grand_total),
  paidByUnitId: r.paid_by_unit_id,
  isDuplicate: !!r.is_duplicate,
  duplicateOfId: r.duplicate_of_id,
  duplicateReason: r.duplicate_reason,
  storagePath: r.storage_path,
  sort: r.sort,
});
export const toLineItem = (r: Row): LineItem => ({
  id: r.id,
  receiptId: r.receipt_id,
  label: r.label,
  price: Number(r.price),
  sourceLabel: r.source_label,
  sort: r.sort,
});
export const toAssignment = (r: Row): Assignment => ({ id: r.id, lineItemId: r.line_item_id, targetType: r.target_type, targetId: r.target_id });

const fromUnit = (u: Unit, tripId: string) => ({ id: u.id, trip_id: tripId, kind: u.kind, name: u.name, color: u.color, sort: u.sort, payid: u.payid });
const fromMember = (m: Member, tripId: string) => ({ id: m.id, trip_id: tripId, unit_id: m.unitId, name: m.name, sort: m.sort });
export const fromReceipt = (r: Receipt, tripId: string) => ({
  id: r.id,
  trip_id: tripId,
  venue_name: r.venueName,
  doc_type: r.docType,
  receipt_number: r.receiptNumber,
  reference_numbers: r.referenceNumbers,
  date_time: r.dateTime,
  subtotal: r.subtotal,
  surcharge_rate: r.surchargeRate,
  surcharge_amount: r.surchargeAmount,
  surcharge_label: r.surchargeLabel,
  tax_included: r.taxIncluded,
  grand_total: r.grandTotal,
  paid_by_unit_id: r.paidByUnitId,
  is_duplicate: r.isDuplicate,
  duplicate_of_id: r.duplicateOfId,
  duplicate_reason: r.duplicateReason,
  storage_path: r.storagePath,
  sort: r.sort,
});
export const fromLineItem = (i: LineItem, tripId: string) => ({
  id: i.id,
  trip_id: tripId,
  receipt_id: i.receiptId,
  label: i.label,
  price: i.price,
  source_label: i.sourceLabel,
  sort: i.sort,
});
const fromAssignment = (a: Assignment, tripId: string) => ({
  id: a.id,
  trip_id: tripId,
  line_item_id: a.lineItemId,
  target_type: a.targetType,
  target_id: a.targetId,
});

export async function loadTripBySlug(sb: SupabaseClient, slug: string): Promise<TripState | null> {
  const { data: trip, error } = await sb.from("trips").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!trip) return null;
  return loadTripContents(sb, toTripMeta(trip));
}

export async function loadTripContents(sb: SupabaseClient, meta: TripMeta): Promise<TripState> {
  const id = meta.id;
  const [units, members, receipts, items, assignments] = await Promise.all([
    sb.from("trip_units").select("*").eq("trip_id", id).order("sort"),
    sb.from("trip_members").select("*").eq("trip_id", id).order("sort"),
    sb.from("receipts").select("*").eq("trip_id", id).order("sort"),
    sb.from("line_items").select("*").eq("trip_id", id).order("sort"),
    sb.from("item_assignments").select("*").eq("trip_id", id),
  ]);
  for (const r of [units, members, receipts, items, assignments]) if (r.error) throw r.error;
  return {
    trip: meta,
    units: (units.data ?? []).map(toUnit),
    members: (members.data ?? []).map(toMember),
    receipts: (receipts.data ?? []).map(toReceipt),
    lineItems: (items.data ?? []).map(toLineItem),
    assignments: (assignments.data ?? []).map(toAssignment),
  };
}

type Table = "trip_units" | "trip_members" | "receipts" | "line_items" | "item_assignments";
interface TableDiff {
  table: Table;
  upserts: Row[];
  deletes: string[];
}

function diffList<T extends { id: string }>(table: Table, prev: T[], next: T[], toRow: (x: T) => Row): TableDiff {
  const before = new Map(prev.map((x) => [x.id, x]));
  const after = new Set(next.map((x) => x.id));
  const upserts: Row[] = [];
  for (const x of next) {
    const old = before.get(x.id);
    if (!old || JSON.stringify(old) !== JSON.stringify(x)) upserts.push(toRow(x));
  }
  const deletes = prev.filter((x) => !after.has(x.id)).map((x) => x.id);
  return { table, upserts, deletes };
}

export interface TripDiff {
  trip: Partial<{ title: string; trip_date: string | null }> | null;
  tables: TableDiff[];
}

/** Compute the database writes needed to go from `prev` to `next`. */
export function diffTrip(prev: TripState, next: TripState): TripDiff {
  const id = next.trip.id;
  const trip: TripDiff["trip"] = {};
  if (prev.trip.title !== next.trip.title) trip.title = next.trip.title;
  if (prev.trip.tripDate !== next.trip.tripDate) trip.trip_date = next.trip.tripDate;
  return {
    trip: Object.keys(trip).length ? trip : null,
    // parent tables first for upserts; deletes are applied in reverse order
    tables: [
      diffList("trip_units", prev.units, next.units, (u) => fromUnit(u, id)),
      diffList("trip_members", prev.members, next.members, (m) => fromMember(m, id)),
      diffList("receipts", prev.receipts, next.receipts, (r) => fromReceipt(r, id)),
      diffList("line_items", prev.lineItems, next.lineItems, (i) => fromLineItem(i, id)),
      diffList("item_assignments", prev.assignments, next.assignments, (a) => fromAssignment(a, id)),
    ],
  };
}

export const isEmptyDiff = (d: TripDiff) => !d.trip && d.tables.every((t) => !t.upserts.length && !t.deletes.length);

export async function applyDiff(sb: SupabaseClient, tripId: string, d: TripDiff) {
  if (d.trip) {
    const { error } = await sb.from("trips").update(d.trip).eq("id", tripId);
    if (error) throw error;
  }
  for (const t of [...d.tables].reverse()) {
    if (!t.deletes.length) continue;
    const { error } = await sb.from(t.table).delete().in("id", t.deletes);
    if (error) throw error;
  }
  for (const t of d.tables) {
    if (!t.upserts.length) continue;
    const q =
      t.table === "item_assignments"
        ? sb.from(t.table).upsert(t.upserts, { onConflict: "line_item_id,target_type,target_id", ignoreDuplicates: true })
        : sb.from(t.table).upsert(t.upserts);
    const { error } = await q;
    if (error) throw error;
  }
}
