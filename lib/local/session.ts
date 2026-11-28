import "server-only";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { findUserById, SESSION_COOKIE, SESSION_DAYS, signSession, verifySession, type LocalUser } from "./store";

/** The signed-in local-mode user for this request, or null. */
export async function getLocalUser(): Promise<LocalUser | null> {
  const store = await cookies();
  const id = await verifySession(store.get(SESSION_COOKIE)?.value);
  return id ? findUserById(id) : null;
}

export async function setSessionCookie(res: NextResponse, userId: string) {
  res.cookies.set(SESSION_COOKIE, await signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_APP_URL?.startsWith("http://"),
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}
