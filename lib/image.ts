"use client";

const MAX_EDGE = 2000;

/**
 * Downscale phone photos before upload (12MP camera shots are 3-6 MB; Gemini reads receipts fine at 2000px).
 * Falls back to the original file for PDFs, HEIC on browsers that can't decode it, or on any error.
 */
export async function prepareReceiptFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024 && file.type !== "image/heic") {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

const EXT_TYPES: Record<string, string> = { heic: "image/heic", heif: "image/heif", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

/** Some browsers leave file.type empty for HEIC; infer from the extension. */
export function withMime(file: File): File {
  if (file.type) return file;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const t = EXT_TYPES[ext];
  return t ? new File([file], file.name, { type: t }) : file;
}

export const isAcceptedFile = (f: File) => f.type.startsWith("image/") || f.type === "application/pdf";
