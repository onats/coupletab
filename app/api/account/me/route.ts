import { NextResponse } from "next/server";
import { getLocalUser } from "@/lib/local/session";
import { publicUser } from "@/lib/local/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which auth mode this server runs in, plus the local-mode user if signed in. */
export async function GET() {
  if (isSupabaseConfigured()) return NextResponse.json({ mode: "supabase", user: null });
  const user = await getLocalUser();
  return NextResponse.json({ mode: "local", user: user ? publicUser(user) : null });
}
