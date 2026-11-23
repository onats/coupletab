import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, zodMessage } from "@/lib/api";
import { fromLineItem, fromReceipt, toReceipt } from "@/lib/db";
import { parseReceiptImage, ReceiptParseError } from "@/lib/gemini";
import { FREE_SCANS_PER_TRIP } from "@/lib/plans";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAdminSupabase, getUser } from "@/lib/supabase/server";
import { receiptFromParsed, uid } from "@/lib/trip-reducer";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

const FormZ = z.object({
  tripId: z.string().uuid().optional(),
  file: z
    .instanceof(File, { message: "Attach a receipt image as `file`" })
    .refine((f) => f.size > 0, "File is empty")
    .refine((f) => f.size <= MAX_BYTES, "File is larger than 10 MB")
    .refine((f) => ALLOWED.includes(f.type), "Use a JPEG, PNG, WebP, HEIC or PDF"),
});

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError("bad_request", "Expected multipart/form-data", 400);
  }
  const input = FormZ.safeParse({ tripId: form.get("tripId") || undefined, file: form.get("file") });
  if (!input.success) return apiError("bad_request", zodMessage(input.error), 400);
  const { file, tripId } = input.data;
  const bytes = Buffer.from(await file.arrayBuffer());

  // Local demo mode: no Supabase configured, just run OCR and hand the result back.
  if (!isSupabaseConfigured()) {
    try {
      const parsed = await parseReceiptImage(bytes, file.type);
      return NextResponse.json({ mode: "local", parsed });
    } catch (e) {
      return parseFailure(e);
    }
  }

  const { sb, user } = await getUser();
  if (!sb || !user) return apiError("unauthorized", "Sign in to scan receipts", 401);
  if (!tripId) return apiError("bad_request", "tripId is required", 400);

  const { data: trip, error: tripErr } = await sb.from("trips").select("id, owner_id").eq("id", tripId).maybeSingle();
  if (tripErr) return apiError("server_error", tripErr.message, 500);
  if (!trip || trip.owner_id !== user.id) return apiError("forbidden", "Only the trip host can scan receipts", 403);

  const admin = getAdminSupabase();
  const { data: allowed, error: quotaErr } = await admin.rpc("consume_ocr_scan", { p_trip: tripId, p_free_limit: FREE_SCANS_PER_TRIP });
  if (quotaErr) return apiError("server_error", quotaErr.message, 500);
  if (!allowed) {
    return apiError("scan_limit", `Free trips include ${FREE_SCANS_PER_TRIP} receipt scans. Unlock this trip for unlimited scans.`, 402);
  }

  const receiptId = uid();
  const storagePath = `${tripId}/${receiptId}.${EXT[file.type] ?? "bin"}`;
  try {
    const [parsed, upload] = await Promise.all([
      parseReceiptImage(bytes, file.type),
      admin.storage.from("receipts").upload(storagePath, bytes, { contentType: file.type, upsert: false }),
    ]);
    if (upload.error) console.error("receipt upload failed", upload.error.message);

    const { data: existingRows, error: exErr } = await admin.from("receipts").select("*").eq("trip_id", tripId);
    if (exErr) throw exErr;
    const existing = (existingRows ?? []).map(toReceipt);
    const { receipt, items } = receiptFromParsed({ receipts: existing }, parsed, {
      id: receiptId,
      storagePath: upload.error ? null : storagePath,
    });

    const { error: insErr } = await admin.from("receipts").insert({ ...fromReceipt(receipt, tripId), source: "ocr", raw: parsed });
    if (insErr) throw insErr;
    if (items.length) {
      const { error: liErr } = await admin.from("line_items").insert(items.map((i) => fromLineItem(i, tripId)));
      if (liErr) throw liErr;
    }
    return NextResponse.json({ mode: "persisted", parsed, receipt, items });
  } catch (e) {
    await admin.rpc("refund_ocr_scan", { p_trip: tripId });
    return parseFailure(e);
  }
}

function parseFailure(e: unknown) {
  if (e instanceof ReceiptParseError) {
    return apiError(e.status === 500 ? "not_configured" : "parse_failed", e.message, e.status);
  }
  console.error("parse-receipt failed", e);
  const message = e instanceof Error ? e.message : "Unexpected error";
  return apiError("server_error", `Could not process the receipt: ${message}`, 500);
}
