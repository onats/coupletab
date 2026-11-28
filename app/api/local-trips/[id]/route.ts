import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getLocalUser } from "@/lib/local/session";
import { deleteTrip, getTrip, saveTrip } from "@/lib/local/store";
import type { TripState } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function owned(ctx: Ctx) {
  const user = await getLocalUser();
  if (!user) return { error: apiError("unauthorized", "Log in first", 401) } as const;
  const { id } = await ctx.params;
  const trip = await getTrip(id);
  if (!trip || trip.ownerId !== user.id) return { error: apiError("not_found", "Trip not found", 404) } as const;
  return { trip } as const;
}

export async function GET(_req: Request, ctx: Ctx) {
  const r = await owned(ctx);
  if ("error" in r) return r.error;
  return NextResponse.json({ status: r.trip.status, state: r.trip.state, updatedAt: r.trip.updatedAt });
}

// The client sends the whole trip state; shape-check the top level and pin the trip identity.
const StateZ = z.object({
  trip: z.object({ title: z.string().max(120) }).passthrough(),
  units: z.array(z.any()).max(100),
  members: z.array(z.any()).max(200),
  receipts: z.array(z.any()).max(500),
  lineItems: z.array(z.any()).max(10_000),
  assignments: z.array(z.any()).max(50_000),
});
const PutZ = z.object({ state: StateZ.optional(), status: z.enum(["active", "archived"]).optional() });

export async function PUT(req: Request, ctx: Ctx) {
  const r = await owned(ctx);
  if ("error" in r) return r.error;
  const body = PutZ.safeParse(await req.json().catch(() => null));
  if (!body.success) return apiError("bad_request", "Invalid trip data", 400);
  const next = { ...r.trip };
  if (body.data.state) {
    const s = body.data.state as unknown as TripState;
    next.state = { ...s, trip: { ...s.trip, id: r.trip.id, slug: r.trip.id, ownerId: r.trip.ownerId, isUnlocked: true } };
  }
  if (body.data.status) next.status = body.data.status;
  const saved = await saveTrip(next);
  return NextResponse.json({ ok: true, updatedAt: saved.updatedAt });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const r = await owned(ctx);
  if ("error" in r) return r.error;
  await deleteTrip(r.trip.id);
  return NextResponse.json({ ok: true });
}
