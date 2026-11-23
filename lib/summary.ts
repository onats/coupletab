import { money } from "./money";
import type { BillResult } from "./split";
import type { TripState } from "./types";

/** Plain-text summary that reads well in WhatsApp / iMessage. */
export function buildSummary(state: TripState, bill: BillResult): string {
  const unitName = new Map(state.units.map((u) => [u.id, u.name]));
  const payid = new Map(state.units.map((u) => [u.id, u.payid]));
  const receipts = state.receipts.filter((r) => !r.isDuplicate);
  const lines: string[] = [];
  lines.push(`🧾 ${state.trip.title}`);
  lines.push(`${receipts.length} receipt${receipts.length === 1 ? "" : "s"} • Total ${money(bill.receiptsTotal)}`);
  for (const r of receipts) {
    const s = bill.receipts[r.id];
    const payer = r.paidByUnitId ? unitName.get(r.paidByUnitId) : null;
    lines.push(`  • ${r.venueName}: ${money(s?.total ?? 0)}${payer ? ` (paid by ${payer})` : ""}`);
  }
  lines.push("");
  lines.push("👫 Final bill per couple");
  for (const b of bill.units) {
    lines.push(`*${b.unit.name}: ${money(b.total)}*`);
    if (b.wholeSubtotal) lines.push(`  ${b.unit.kind === "couple" ? "Shared as couple" : "Items"}: ${money(b.wholeSubtotal)}`);
    for (const m of b.memberSubtotals) if (m.amount) lines.push(`  ${m.name}: ${money(m.amount)}`);
    if (b.surcharge) lines.push(`  Surcharge: ${money(b.surcharge)}`);
  }
  if (bill.unassigned.count) {
    lines.push("");
    lines.push(`⚠️ ${bill.unassigned.count} item(s) still unassigned (${money(bill.unassigned.amount)})`);
  }
  if (bill.transfers.length) {
    lines.push("");
    lines.push("💸 Settle up");
    for (const t of bill.transfers) {
      const pid = payid.get(t.toUnitId);
      lines.push(`${unitName.get(t.fromUnitId)} → ${unitName.get(t.toUnitId)}: ${money(t.amount)}${pid ? ` (PayID/BSB: ${pid})` : ""}`);
    }
  } else if (bill.receiptsMissingPayer === 0 && bill.units.length) {
    lines.push("");
    lines.push("✅ All square, nobody owes anything");
  }
  lines.push("");
  lines.push("Split with CoupleTab");
  return lines.join("\n");
}
