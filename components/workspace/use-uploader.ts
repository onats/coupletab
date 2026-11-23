"use client";
import { useCallback, useRef, useState } from "react";
import { findDuplicate } from "@/lib/dedupe";
import { isAcceptedFile, prepareReceiptFile, withMime } from "@/lib/image";
import type { NormalizedReceipt } from "@/lib/receipt-schema";
import { receiptFromParsed } from "@/lib/trip-reducer";
import type { LineItem, Receipt } from "@/lib/types";
import type { TripStore } from "@/lib/use-trip-store";
import { readApiError } from "@/lib/utils";

export type UploadStatus = "queued" | "preparing" | "reading" | "done" | "duplicate" | "error";
export interface UploadJob {
  id: string;
  name: string;
  preview: string | null;
  status: UploadStatus;
  message?: string;
  code?: string;
}

const CONCURRENCY = 3;

export function useUploader(store: TripStore, opts: { persisted: boolean; onLimit?: (code: string) => void }) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const queue = useRef<{ job: UploadJob; file: File }[]>([]);
  const active = useRef(0);
  const storeRef = useRef(store);
  storeRef.current = store;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const patch = (id: string, p: Partial<UploadJob>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...p } : j)));

  const runOne = useCallback(async (job: UploadJob, original: File) => {
    const s = storeRef.current;
    try {
      patch(job.id, { status: "preparing" });
      const file = await prepareReceiptFile(original);
      patch(job.id, { status: "reading" });
      const fd = new FormData();
      fd.append("file", file);
      if (optsRef.current.persisted && s.state) fd.append("tripId", s.state.trip.id);
      const res = await fetch("/api/parse-receipt", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await readApiError(res);
        patch(job.id, { status: "error", message: err.message, code: err.code });
        if (err.code === "scan_limit" || err.code === "unauthorized") optsRef.current.onLimit?.(err.code);
        return;
      }
      const data = (await res.json()) as
        | { mode: "local"; parsed: NormalizedReceipt }
        | { mode: "persisted"; parsed: NormalizedReceipt; receipt: Receipt; items: LineItem[] };
      const latest = storeRef.current;
      if (!latest.state) return;
      let receipt: Receipt;
      if (data.mode === "persisted") {
        receipt = data.receipt;
        latest.addSavedReceipt(data.receipt, data.items);
        // Parallel uploads can race the server-side check, so re-check against everything we have now.
        if (!receipt.isDuplicate) {
          const dup = findDuplicate(receipt, latest.state.receipts);
          if (dup) {
            latest.dispatch({ type: "receipt/update", id: receipt.id, patch: { isDuplicate: true, duplicateOfId: dup.duplicateOfId, duplicateReason: dup.reason } });
            receipt = { ...receipt, isDuplicate: true, duplicateReason: dup.reason };
          }
        }
      } else {
        const built = receiptFromParsed(latest.state, data.parsed);
        receipt = built.receipt;
        latest.dispatch({ type: "receipt/add", receipt: built.receipt, items: built.items });
      }
      patch(job.id, {
        status: receipt.isDuplicate ? "duplicate" : "done",
        message: receipt.isDuplicate
          ? `${receipt.venueName}: ${receipt.duplicateReason ?? "duplicate"}, left out of the totals`
          : `${receipt.venueName}: ${data.parsed.items.length} item${data.parsed.items.length === 1 ? "" : "s"}`,
      });
    } catch (e) {
      patch(job.id, { status: "error", message: e instanceof Error ? e.message : "Upload failed" });
    }
  }, []);

  const pump = useCallback(() => {
    while (active.current < CONCURRENCY && queue.current.length) {
      const next = queue.current.shift()!;
      active.current++;
      void runOne(next.job, next.file).finally(() => {
        active.current--;
        pump();
      });
    }
  }, [runOne]);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const files = Array.from(list).map(withMime);
      const newJobs: UploadJob[] = [];
      for (const f of files) {
        const job: UploadJob = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: f.name || "Photo",
          preview: f.type.startsWith("image/") && !f.type.includes("hei") ? URL.createObjectURL(f) : null,
          status: isAcceptedFile(f) ? "queued" : "error",
          message: isAcceptedFile(f) ? undefined : "Not an image or PDF",
        };
        newJobs.push(job);
        if (isAcceptedFile(f)) queue.current.push({ job, file: f });
      }
      setJobs((js) => [...newJobs, ...js]);
      pump();
    },
    [pump],
  );

  const dismiss = useCallback((id: string) => setJobs((js) => js.filter((j) => j.id !== id)), []);
  const clearFinished = useCallback(() => setJobs((js) => js.filter((j) => !["done", "duplicate", "error"].includes(j.status))), []);

  return { jobs, addFiles, dismiss, clearFinished, busy: jobs.some((j) => ["queued", "preparing", "reading"].includes(j.status)) };
}
