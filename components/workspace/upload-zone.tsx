"use client";
import { Camera, CheckCircle2, Copy, ImagePlus, Loader2, Plus, UploadCloud, X, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { UploadJob } from "./use-uploader";

const STATUS_TEXT: Record<UploadJob["status"], string> = {
  queued: "Waiting…",
  preparing: "Shrinking photo…",
  reading: "Reading receipt…",
  done: "Added",
  duplicate: "Duplicate skipped",
  error: "Failed",
};

export function UploadZone({
  jobs,
  onFiles,
  onDismiss,
  onClear,
  onManual,
  disabled,
  hint,
}: {
  jobs: UploadJob[];
  onFiles: (files: File[]) => void;
  onDismiss: (id: string) => void;
  onClear: () => void;
  onManual: () => void;
  disabled?: boolean;
  hint?: React.ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [pageDrag, setPageDrag] = useState(false);

  // Whole-page drag & drop and Cmd/Ctrl+V paste of screenshots.
  useEffect(() => {
    if (disabled) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setPageDrag(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setPageDrag(false);
    };
    const overFn = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setPageDrag(false);
      setOver(false);
      if (e.dataTransfer?.files?.length) onFiles(Array.from(e.dataTransfer.files));
    };
    const paste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        onFiles(files);
      }
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", overFn);
    window.addEventListener("drop", drop);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", overFn);
      window.removeEventListener("drop", drop);
      window.removeEventListener("paste", paste);
    };
  }, [onFiles, disabled]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) onFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const finished = jobs.filter((j) => ["done", "duplicate", "error"].includes(j.status)).length;

  return (
    <>
      {pageDrag && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-blue-700/20 backdrop-blur-[1px]">
          <div className="rounded-2xl border-2 border-dashed border-blue-600 bg-white px-10 py-8 text-center shadow-xl">
            <UploadCloud className="mx-auto h-10 w-10 text-blue-700" />
            <p className="mt-2 text-lg font-semibold">Drop receipts anywhere</p>
            <p className="text-sm text-slate-500">We&apos;ll read them all at once</p>
          </div>
        </div>
      )}
      <Card className="p-4 sm:p-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onClick={() => !disabled && fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors sm:py-8",
            over ? "border-blue-600 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <UploadCloud className="h-9 w-9 text-blue-700" />
          <p className="mt-2 text-base font-semibold">Add receipts</p>
          <p className="mt-0.5 max-w-sm text-sm text-slate-500">
            Drop photos or PDFs here, paste a screenshot, or tap to choose. Add as many as you like; duplicates are spotted for you.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="lg" className="sm:hidden" onClick={() => camRef.current?.click()} disabled={disabled}>
              <Camera className="h-5 w-5" /> Take photo
            </Button>
            <Button size="lg" variant="outline" onClick={() => fileRef.current?.click()} disabled={disabled}>
              <ImagePlus className="h-5 w-5" /> Choose files
            </Button>
            <Button size="lg" variant="ghost" onClick={onManual} disabled={disabled}>
              <Plus className="h-5 w-5" /> Type one in
            </Button>
          </div>
          {hint && <div className="mt-3 text-xs text-slate-500">{hint}</div>}
        </div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf,.heic,.heif" multiple hidden onChange={pick} />
        <input id="receipt-camera-input" ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />

        {jobs.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span>
                {finished}/{jobs.length} processed
              </span>
              {finished > 0 && (
                <button className="hover:text-slate-800" onClick={onClear}>
                  Clear finished
                </button>
              )}
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {jobs.map((j) => (
                <li key={j.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-slate-100">
                    {j.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={j.preview} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-slate-400">FILE</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      {["queued", "preparing", "reading"].includes(j.status) && <Loader2 className="h-4 w-4 animate-spin text-blue-700" />}
                      {j.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                      {j.status === "duplicate" && <Copy className="h-4 w-4 text-amber-600" />}
                      {j.status === "error" && <XCircle className="h-4 w-4 text-red-600" />}
                      {STATUS_TEXT[j.status]}
                    </div>
                    <p className={cn("truncate text-xs", j.status === "error" ? "text-red-600" : "text-slate-500")}>{j.message ?? j.name}</p>
                  </div>
                  <button aria-label="Dismiss" className="text-slate-400 hover:text-slate-700" onClick={() => onDismiss(j.id)}>
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </>
  );
}
