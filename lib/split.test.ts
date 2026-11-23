import { describe, expect, it } from "vitest";
import { findDuplicate } from "./dedupe";
import { expandItems, GeminiReceiptZ, normalizeReceipt } from "./receipt-schema";
import { computeBill, settle } from "./split";
import { emptyTrip, receiptFromParsed, tripReducer, type TripAction } from "./trip-reducer";
import type { TripState } from "./types";

function setup() {
  let s = emptyTrip();
  s = tripReducer(s, { type: "unit/add", kind: "couple", name: "Couple 1", memberNames: ["Male 1", "Female 1"] });
  s = tripReducer(s, { type: "unit/add", kind: "couple", name: "Couple 2", memberNames: ["Male 2", "Female 2"] });
  s = tripReducer(s, { type: "unit/add", kind: "single", name: "Single 1", memberNames: ["Single 1"] });
  const parsed = normalizeReceipt(
    GeminiReceiptZ.parse({
      document_type: "tax_invoice",
      venue_name: "Bendooley Estate Restaurant",
      receipt_number: "237250",
      reference_numbers: ["20703"],
      surcharge_rate: 10,
      grand_total: 455.4,
      line_items: [
        { name: "Pork Collar", quantity: 1, total_price: 38 },
        { name: "Crab", quantity: 3, total_price: 114 },
        { name: "Fries", quantity: 1, total_price: 14 },
        { name: "Rocket Salad", quantity: 1, total_price: 17 },
      ],
    }),
  );
  const { receipt, items } = receiptFromParsed(s, parsed);
  s = tripReducer(s, { type: "receipt/add", receipt, items });
  const [c1, c2, s1] = s.units;
  const m = (name: string) => s.members.find((x) => x.name === name)!.id;
  const item = (label: string) => s.lineItems.find((x) => x.label === label)!.id;
  return { s, c1, c2, s1, m, item };
}

const run = (s: TripState, actions: TripAction[]) => actions.reduce(tripReducer, s);

describe("expandItems", () => {
  it("expands multi-quantity rows into cent-exact portions", () => {
    const out = expandItems([{ name: "Crab", quantity: 3, unit_price: null, total_price: 114 }]);
    expect(out.map((o) => o.label)).toEqual(["Crab (1 of 3)", "Crab (2 of 3)", "Crab (3 of 3)"]);
    expect(out.every((o) => o.price === 38)).toBe(true);
    const odd = expandItems([{ name: "Oyster", quantity: 3, unit_price: null, total_price: 10 }]);
    expect(odd.map((o) => o.price)).toEqual([3.34, 3.33, 3.33]);
  });
});

describe("computeBill", () => {
  it("matches the prototype: whole couple = 1 share, partner overrides roll up, 10% surcharge", () => {
    const { s, c1, c2, s1, m, item } = setup();
    const st = run(s, [
      { type: "assign/toggle", lineItemId: item("Pork Collar"), targetType: "member", targetId: m("Male 1") },
      { type: "assign/toggle", lineItemId: item("Crab (1 of 3)"), targetType: "unit", targetId: c2.id },
      { type: "assign/toggle", lineItemId: item("Crab (3 of 3)"), targetType: "member", targetId: m("Female 2") },
      { type: "assign/toggle", lineItemId: item("Rocket Salad"), targetType: "unit", targetId: c2.id },
      { type: "assign/toggle", lineItemId: item("Fries"), targetType: "unit", targetId: s1.id },
    ]);
    const bill = computeBill(st);
    const by = (id: string) => bill.units.find((u) => u.unit.id === id)!;
    expect(by(c1.id).total).toBe(41.8);
    expect(by(c1.id).surcharge).toBe(3.8);
    expect(by(c2.id).wholeSubtotal).toBe(55);
    expect(by(c2.id).memberSubtotals.find((x) => x.name === "Female 2")!.amount).toBe(38);
    expect(by(c2.id).surcharge).toBe(9.3);
    expect(by(c2.id).total).toBe(102.3);
    expect(by(s1.id).total).toBe(15.4);
    expect(bill.unassigned.count).toBe(1);
    expect(bill.unassigned.amount).toBe(41.8);
    expect(bill.receiptsTotal).toBe(201.3);
  });

  it("splits by shares: couple + single = 50/50, two partners + couple = 3 shares", () => {
    const { s, c1, s1, m, item } = setup();
    let st = run(s, [
      { type: "assign/toggle", lineItemId: item("Fries"), targetType: "unit", targetId: c1.id },
      { type: "assign/toggle", lineItemId: item("Fries"), targetType: "unit", targetId: s1.id },
    ]);
    let bill = computeBill(st);
    expect(bill.units.find((u) => u.unit.id === c1.id)!.itemsSubtotal).toBe(7);
    expect(bill.units.find((u) => u.unit.id === s1.id)!.itemsSubtotal).toBe(7);

    st = run(s, [
      { type: "assign/toggle", lineItemId: item("Pork Collar"), targetType: "member", targetId: m("Male 1") },
      { type: "assign/toggle", lineItemId: item("Pork Collar"), targetType: "member", targetId: m("Female 1") },
      { type: "assign/toggle", lineItemId: item("Pork Collar"), targetType: "member", targetId: m("Male 2") },
    ]);
    bill = computeBill(st);
    expect(bill.units.find((u) => u.unit.id === c1.id)!.itemsSubtotal).toBeCloseTo(25.33, 2);
  });

  it("whole-couple and partner chips are mutually exclusive on one item", () => {
    const { s, c1, m, item } = setup();
    const st = run(s, [
      { type: "assign/toggle", lineItemId: item("Fries"), targetType: "member", targetId: m("Male 1") },
      { type: "assign/toggle", lineItemId: item("Fries"), targetType: "unit", targetId: c1.id },
    ]);
    expect(st.assignments).toHaveLength(1);
    expect(st.assignments[0].targetType).toBe("unit");
  });

  it("All Units toggles every unit on and off", () => {
    const { s, item } = setup();
    const on = tripReducer(s, { type: "assign/all", lineItemId: item("Fries") });
    expect(on.assignments).toHaveLength(3);
    expect(tripReducer(on, { type: "assign/all", lineItemId: item("Fries") }).assignments).toHaveLength(0);
  });

  it("computes net settlement against who paid", () => {
    const { s, c1, c2, s1, item } = setup();
    const receiptId = s.receipts[0].id;
    let st = s;
    for (const li of s.lineItems) st = tripReducer(st, { type: "assign/all", lineItemId: li.id });
    st = tripReducer(st, { type: "receipt/update", id: receiptId, patch: { paidByUnitId: c1.id } });
    void item;
    const bill = computeBill(st);
    expect(bill.unassigned.count).toBe(0);
    // 183 of items * 1.1 = 201.30, split three ways
    expect(bill.transfers.map((t) => t.toUnitId)).toEqual([c1.id, c1.id]);
    expect(new Set(bill.transfers.map((t) => t.fromUnitId))).toEqual(new Set([c2.id, s1.id]));
    const owed = bill.transfers.reduce((a, t) => a + t.amount, 0);
    expect(owed).toBeCloseTo(134.2, 2);
  });
});

describe("settle", () => {
  it("uses at most n-1 transfers and conserves money", () => {
    const t = settle([
      { id: "a", net: 100 },
      { id: "b", net: -30 },
      { id: "c", net: -70 },
      { id: "d", net: 0 },
    ]);
    expect(t).toEqual([
      { fromUnitId: "c", toUnitId: "a", amount: 70 },
      { fromUnitId: "b", toUnitId: "a", amount: 30 },
    ]);
  });
});

describe("findDuplicate", () => {
  const base = {
    id: "1",
    venueName: "Bendooley Estate Restaurant",
    docType: "tax_invoice" as const,
    receiptNumber: "237250",
    referenceNumbers: [],
    dateTime: "2026-11-22T13:52:00",
    grandTotal: 455.4,
  };
  it("flags guest bill vs tax invoice for the same meal", () => {
    const d = findDuplicate({ ...base, id: "2", docType: "guest_bill", receiptNumber: "20703" }, [base]);
    expect(d?.reason).toMatch(/Guest bill and tax invoice/);
  });
  it("flags shared receipt numbers", () => {
    expect(findDuplicate({ ...base, id: "2", grandTotal: 1, referenceNumbers: ["#237250"] }, [base])).not.toBeNull();
  });
  it("does not flag different venues with the same total", () => {
    expect(findDuplicate({ ...base, id: "2", venueName: "Franquette Creperie", receiptNumber: "99" }, [base])).toBeNull();
  });
  it("flags EFTPOS slips", () => {
    expect(findDuplicate({ ...base, id: "2", venueName: "EFTPOS", docType: "payment_slip", receiptNumber: null }, [base])).not.toBeNull();
  });
});
