import type { DocType } from "./types";

export interface DedupeCandidate {
  id: string;
  venueName: string;
  docType: DocType;
  receiptNumber: string | null;
  referenceNumbers: string[];
  dateTime: string | null;
  grandTotal: number | null;
  isDuplicate?: boolean;
}

const STOP = new Set(["the", "and", "pty", "ltd", "restaurant", "cafe", "bar"]);
const normNum = (s: string) => s.replace(/[^0-9a-z]/gi, "").replace(/^0+/, "").toLowerCase();
const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );

export function venueSimilar(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return a.trim().toLowerCase() === b.trim().toLowerCase();
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.min(ta.size, tb.size) >= 0.5;
}

const day = (s: string | null) => (s ? s.slice(0, 10) : null);

/**
 * Returns the existing receipt that `c` duplicates, if any. Catches the common case of
 * uploading both the "Guest Bill" and the "Tax Invoice" (or the EFTPOS slip) for one meal.
 */
export function findDuplicate(
  c: DedupeCandidate,
  existing: DedupeCandidate[],
): { duplicateOfId: string; reason: string } | null {
  const cNums = [c.receiptNumber, ...c.referenceNumbers]
    .filter((n): n is string => !!n)
    .map(normNum)
    .filter((n) => n.length >= 3);
  for (const e of existing) {
    if (e.id === c.id || e.isDuplicate) continue;
    const sameTotal = c.grandTotal != null && e.grandTotal != null && Math.abs(c.grandTotal - e.grandTotal) < 0.011;
    const sameVenue = venueSimilar(c.venueName, e.venueName);
    const dc = day(c.dateTime);
    const de = day(e.dateTime);
    const dateOk = !dc || !de || dc === de;

    const eNums = [e.receiptNumber, ...e.referenceNumbers].filter((n): n is string => !!n).map(normNum);
    if (cNums.some((n) => eNums.includes(n)) && (sameVenue || sameTotal)) {
      return { duplicateOfId: e.id, reason: `Same receipt number as ${e.venueName}` };
    }
    if (sameTotal && dateOk && (c.docType === "payment_slip" || e.docType === "payment_slip")) {
      return { duplicateOfId: e.id, reason: `Card payment slip for the same $${c.grandTotal!.toFixed(2)} bill` };
    }
    if (sameTotal && sameVenue && dateOk) {
      const kinds = new Set([c.docType, e.docType]);
      const why =
        kinds.has("guest_bill") && kinds.has("tax_invoice")
          ? "Guest bill and tax invoice for the same meal"
          : "Same venue, date and total as another receipt";
      return { duplicateOfId: e.id, reason: why };
    }
  }
  return null;
}
