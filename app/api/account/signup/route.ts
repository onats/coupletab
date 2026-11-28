import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, zodMessage } from "@/lib/api";
import { setSessionCookie } from "@/lib/local/session";
import { createUser, EmailTakenError, publicUser } from "@/lib/local/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";

const BodyZ = z.object({
  name: z.string().trim().min(1, "Tell us your name").max(80),
  email: z.string().trim().email("Enter a valid email").max(200),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export async function POST(req: Request) {
  if (isSupabaseConfigured()) return apiError("bad_request", "Sign-up goes through Supabase on this server", 400);
  const body = BodyZ.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return apiError("bad_request", body.error.issues[0]?.message ?? zodMessage(body.error), 400);
  try {
    const user = await createUser(body.data);
    const res = NextResponse.json({ user: publicUser(user) });
    await setSessionCookie(res, user.id);
    return res;
  } catch (e) {
    if (e instanceof EmailTakenError) return apiError("bad_request", "An account with that email already exists. Log in instead.", 409);
    throw e;
  }
}
