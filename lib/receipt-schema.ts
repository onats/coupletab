import { z } from "zod";
import { round2, splitCents } from "./money";
import type { DocType } from "./types";

const num = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return v;
}, z.number().finite().nullable());

const optNum = num.optional().transform((v) => v ?? null);
const optStr = z
  .string()
  .nullish()
  .transform((v) => v?.trim() || null);

/** Validates the raw JSON that Gemini returns. Lenient on types, strict on shape. */
export const GeminiReceiptZ = z.object({
  is_receipt: z.boolean().nullish().transform((v) => v ?? true),
  document_type: z.enum(["itemised_receipt", "guest_bill", "tax_invoice", "payment_slip", "other"]).catch("other"),
  venue_name: z
    .string()
    .nullish()
    .transform((v) => v?.trim() || "Unknown venue"),
  receipt_number: optStr,
  reference_numbers: z
    .array(z.string())
    .nullish()
    .transform((v) => (v ?? []).map((s) => s.trim()).filter(Boolean)),
  date_time: optStr,
  subtotal: optNum,
  surcharge_amount: optNum,
  surcharge_rate: optNum,
  surcharge_label: optStr,
  tax_included: z.boolean().nullish().transform((v) => v ?? true),
  grand_total: optNum,
  line_items: z
    .array(
      z.object({
        name: z.string().transform((s) => s.trim()),
        quantity: num.optional().transform((v) => v ?? 1),
        unit_price: optNum,
        total_price: optNum,
      }),
    )
    .nullish()
    .transform((v) => v ?? []),
});
export type GeminiReceipt = z.infer<typeof GeminiReceiptZ>;

export interface NormalizedItem {
  label: string;
  price: number;
  sourceLabel: string | null;
}

export interface NormalizedReceipt {
  venueName: string;
  docType: DocType;
  receiptNumber: string | null;
  referenceNumbers: string[];
  dateTime: string | null;
  subtotal: number | null;
  surchargeRate: number;
  surchargeAmount: number | null;
  surchargeLabel: string | null;
  taxIncluded: boolean;
  grandTotal: number | null;
  items: NormalizedItem[];
}

const MAX_EXPAND = 30;

/** Expand "3x Crab $114.00" into three "Crab (n of 3)" items at $38.00 each (cent exact). */
export function expandItems(raw: GeminiReceipt["line_items"]): NormalizedItem[] {
  const out: NormalizedItem[] = [];
  for (const li of raw) {
    if (!li.name) continue;
    const qty = li.quantity ?? 1;
    const total = li.total_price ?? (li.unit_price != null ? li.unit_price * qty : null);
    if (total == null) continue;
    const wholeQty = Number.isInteger(qty) && qty >= 2 && qty <= MAX_EXPAND;
    if (!wholeQty) {
      out.push({ label: li.name, price: round2(total), sourceLabel: qty !== 1 ? `${qty} × ${li.name}` : null });
      continue;
    }
    const parts = splitCents(total, qty);
    const source = `${qty}x ${li.name} $${round2(total).toFixed(2)}`;
    parts.forEach((p, i) => out.push({ label: `${li.name} (${i + 1} of ${qty})`, price: p, sourceLabel: source }));
  }
  return out;
}

export function normalizeReceipt(g: GeminiReceipt): NormalizedReceipt {
  const items = expandItems(g.line_items);
  const itemsSum = round2(items.reduce((a, i) => a + i.price, 0));
  // Gemini is asked for a percentage (10 = 10%), but accept a fraction (0.1) too.
  let rate = g.surcharge_rate ?? 0;
  if (rate > 1) rate = rate / 100;
  if (!rate && g.surcharge_amount && itemsSum > 0) rate = g.surcharge_amount / itemsSum;
  rate = Math.max(0, Math.min(rate, 1));
  return {
    venueName: g.venue_name,
    docType: g.document_type,
    receiptNumber: g.receipt_number,
    referenceNumbers: g.reference_numbers,
    dateTime: g.date_time,
    subtotal: g.subtotal ?? itemsSum,
    surchargeRate: Math.round(rate * 10000) / 10000,
    surchargeAmount: g.surcharge_amount,
    surchargeLabel: g.surcharge_label,
    taxIncluded: g.tax_included,
    grandTotal: g.grand_total,
    items,
  };
}
