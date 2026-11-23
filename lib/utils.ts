import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export async function readApiError(res: Response): Promise<{ code: string; message: string }> {
  try {
    const j = (await res.json()) as { error?: { code?: string; message?: string } };
    return { code: j.error?.code ?? "server_error", message: j.error?.message ?? res.statusText };
  } catch {
    return { code: "server_error", message: res.statusText || `HTTP ${res.status}` };
  }
}
