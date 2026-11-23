import "server-only";
import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { GeminiReceiptZ, normalizeReceipt, type NormalizedReceipt } from "./receipt-schema";

export const RECEIPT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    is_receipt: { type: Type.BOOLEAN, description: "false if the image is not a bill, receipt or invoice" },
    document_type: {
      type: Type.STRING,
      enum: ["itemised_receipt", "guest_bill", "tax_invoice", "payment_slip", "other"],
      description: "guest_bill = pre-payment bill brought to the table; tax_invoice = printed after payment; payment_slip = EFTPOS/card terminal slip",
    },
    venue_name: { type: Type.STRING },
    receipt_number: { type: Type.STRING, nullable: true, description: "Main receipt / invoice / bill number" },
    reference_numbers: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Any other bill, table, order, check or transaction numbers printed",
    },
    date_time: { type: Type.STRING, nullable: true, description: "ISO 8601 local date-time, e.g. 2026-11-22T13:52:00" },
    subtotal: { type: Type.NUMBER, nullable: true, description: "Sum of line items before surcharges" },
    surcharge_amount: { type: Type.NUMBER, nullable: true, description: "Total of venue-wide surcharges/service charges/tips in dollars" },
    surcharge_rate: { type: Type.NUMBER, nullable: true, description: "Surcharge as a percentage, e.g. 10 for 10%. 0 if none" },
    surcharge_label: { type: Type.STRING, nullable: true, description: "e.g. 'Sunday surcharge 10%'" },
    tax_included: { type: Type.BOOLEAN, description: "true when prices already include GST/VAT" },
    grand_total: { type: Type.NUMBER, nullable: true },
    line_items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          quantity: { type: Type.NUMBER, description: "Number of units on the row, default 1" },
          unit_price: { type: Type.NUMBER, nullable: true },
          total_price: { type: Type.NUMBER, description: "Row total (quantity x unit price). Negative for discounts" },
        },
        required: ["name", "quantity", "total_price"],
        propertyOrdering: ["name", "quantity", "unit_price", "total_price"],
      },
    },
  },
  required: ["is_receipt", "document_type", "venue_name", "line_items", "tax_included"],
  propertyOrdering: [
    "is_receipt",
    "document_type",
    "venue_name",
    "receipt_number",
    "reference_numbers",
    "date_time",
    "line_items",
    "subtotal",
    "surcharge_amount",
    "surcharge_rate",
    "surcharge_label",
    "tax_included",
    "grand_total",
  ],
};

const PROMPT = `You are extracting a hospitality receipt (Australia by default, prices in AUD, GST usually included) so a group can split it.
Rules:
- One entry per printed product row. Keep the quantity and the row TOTAL exactly as printed; do not expand quantities yourself.
- Modifiers printed under an item with their own price (e.g. "+ extra cheese 2.00") become their own rows. Unpriced modifiers are ignored.
- Discounts/vouchers are rows with a negative total_price.
- Do NOT include subtotal, GST/tax, surcharge, tip, rounding, change or payment rows as line items.
- Weekend/Sunday/public-holiday surcharges, service charges, card surcharges and tips go into surcharge_amount (summed) and surcharge_rate as a percentage of the item subtotal. Cellar doors and shops usually have 0.
- GST that is already included in prices is NOT a surcharge.
- If the image is an EFTPOS/card terminal slip with no items, set document_type to payment_slip, line_items to [] and grand_total to the amount charged.
- Use null for anything you cannot read. Never invent items.`;

export class ReceiptParseError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message);
  }
}

export async function parseReceiptImage(data: Buffer, mimeType: string): Promise<NormalizedReceipt> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ReceiptParseError("GEMINI_API_KEY is not configured on the server", 500);
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { data: data.toString("base64"), mimeType } }, { text: PROMPT }],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: RECEIPT_SCHEMA,
      temperature: 0,
    },
  });
  const text = res.text;
  if (!text) throw new ReceiptParseError("The AI returned an empty response. Try a clearer photo.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ReceiptParseError("Could not read the AI response. Try again.");
  }
  const parsed = GeminiReceiptZ.safeParse(json);
  if (!parsed.success) throw new ReceiptParseError("The receipt data did not validate. Try a clearer photo.");
  if (!parsed.data.is_receipt) throw new ReceiptParseError("That doesn't look like a receipt.");
  return normalizeReceipt(parsed.data);
}
