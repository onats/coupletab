import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { setSessionCookie } from "@/lib/local/session";
import { checkPassword, findUserByEmail, publicUser } from "@/lib/local/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";

const BodyZ = z.object({ email: z.string().trim().max(200), password: z.string().max(200) });

export async function POST(req: Request) {
  if (isSupabaseConfigured()) return apiError("bad_request", "Sign-in goes through Supabase on this server", 400);
  const body = BodyZ.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return apiError("bad_request", "Enter your email and password", 400);
  const user = await findUserByEmail(body.data.email);
  if (!user || !(await checkPassword(body.data.password, user.passwordHash))) {
    return apiError("unauthorized", "That email and password don't match", 401);
  }
  const res = NextResponse.json({ user: publicUser(user) });
  await setSessionCookie(res, user.id);
  return res;
}
