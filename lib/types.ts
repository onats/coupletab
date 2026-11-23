export type UnitKind = "couple" | "single";
export type TargetType = "unit" | "member";
export type PlanTier = "free" | "trip_pass" | "pro";
export type DocType =
  | "itemised_receipt"
  | "guest_bill"
  | "tax_invoice"
  | "payment_slip"
  | "other";

export interface Unit {
  id: string;
  kind: UnitKind;
  name: string;
  color: string;
  sort: number;
  payid: string | null;
}

export interface Member {
  id: string;
  unitId: string;
  name: string;
  sort: number;
}

export interface Receipt {
  id: string;
  venueName: string;
  docType: DocType;
  receiptNumber: string | null;
  referenceNumbers: string[];
  dateTime: string | null;
  subtotal: number | null;
  /** Fraction, e.g. 0.1 for a 10% weekend surcharge. Source of truth for proportional surcharge. */
  surchargeRate: number;
  surchargeAmount: number | null;
  surchargeLabel: string | null;
  taxIncluded: boolean;
  grandTotal: number | null;
  paidByUnitId: string | null;
  isDuplicate: boolean;
  duplicateOfId: string | null;
  duplicateReason: string | null;
  storagePath: string | null;
  sort: number;
}

export interface LineItem {
  id: string;
  receiptId: string;
  label: string;
  price: number;
  sourceLabel: string | null;
  sort: number;
}

export interface Assignment {
  id: string;
  lineItemId: string;
  targetType: TargetType;
  targetId: string;
}

export interface TripMeta {
  id: string;
  slug: string;
  title: string;
  tripDate: string | null;
  isUnlocked: boolean;
  ownerId: string | null;
  joinToken: string | null;
}

export interface TripState {
  trip: TripMeta;
  units: Unit[];
  members: Member[];
  receipts: Receipt[];
  lineItems: LineItem[];
  assignments: Assignment[];
}

/** Shape stored in saved_groups.units (jsonb). */
export interface GroupPreset {
  kind: UnitKind;
  name: string;
  members: string[];
  payid?: string | null;
}
