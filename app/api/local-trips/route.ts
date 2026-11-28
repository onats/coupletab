import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, zodMessage } from "@/lib/api";
import { getLocalUser } from "@/lib/local/session";
import { listTrips, saveTrip } from "@/lib/local/store";
import { defaultTrip } from "@/lib/trip-reducer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getLocalUser();
  if (!user) return apiError("unauthorized", "Log in first", 401);
  const trips = await listTrips(user.id);
  return NextResponse.json({
    trips: trips.map((t) => ({
      id: t.id,
      title: t.state.trip.title,
      tripDate: t.state.trip.tripDate,
      status: t.status,
      receipts: t.state.receipts.filter((r) => !r.isDuplicate).length,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
  });
}

const BodyZ = z.object({ title: z.string().trim().min(1).max(120).optional() });

export async function POST(req: Request) {
  const user = await getLocalUser();
  if (!user) return apiError("unauthorized", "Log in first", 401);
  const body = BodyZ.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return apiError("bad_request", zodMessage(body.error), 400);
  const id = nanoid(12).replace(/[^A-Za-z0-9_-]/g, "x");
  const now = new Date().toISOString();
  const state = defaultTrip({ id, slug: id, title: body.data.title ?? "Weekend away", ownerId: user.id, isUnlocked: true });
  await saveTrip({ id, ownerId: user.id, status: "active", createdAt: now, updatedAt: now, state });
  return NextResponse.json({ id, slug: id });
}
