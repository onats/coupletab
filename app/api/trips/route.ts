import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, zodMessage } from "@/lib/api";
import { FREE_ACTIVE_TRIPS } from "@/lib/plans";
import { getAdminSupabase, getUser } from "@/lib/supabase/server";
import { defaultTrip, emptyTrip, tripReducer } from "@/lib/trip-reducer";
import type { GroupPreset } from "@/lib/types";

export const runtime = "nodejs";

const BodyZ = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  tripDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  savedGroupId: z.string().uuid().optional(),
});

const PresetZ = z.array(
  z.object({
    kind: z.enum(["couple", "single"]),
    name: z.string().max(60),
    members: z.array(z.string().max(60)).max(2),
    payid: z.string().max(120).nullish(),
  }),
);

/** Create a trip tab. Enforces the free-tier limit of one active (non-unlocked) trip. */
export async function POST(req: Request) {
  const body = BodyZ.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return apiError("bad_request", zodMessage(body.error), 400);

  const { sb, user } = await getUser();
  if (!sb || !user) return apiError("unauthorized", "Sign in first", 401);

  const admin = getAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("plan_tier").eq("id", user.id).maybeSingle();
  if (profile?.plan_tier !== "pro") {
    const { count, error } = await admin
      .from("trips")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("status", "active")
      .eq("is_unlocked", false);
    if (error) return apiError("server_error", error.message, 500);
    if ((count ?? 0) >= FREE_ACTIVE_TRIPS) {
      return apiError("trip_limit", "The free plan includes one active trip. Archive it or upgrade to Pro Host.", 402);
    }
  }

  let preset: GroupPreset[] | null = null;
  if (body.data.savedGroupId) {
    const { data: g } = await sb.from("saved_groups").select("units").eq("id", body.data.savedGroupId).maybeSingle();
    const parsed = PresetZ.safeParse(g?.units);
    if (parsed.success) preset = parsed.data;
  }

  const slug = nanoid(10).replace(/[^A-Za-z0-9_-]/g, "x");
  const { data: trip, error } = await admin
    .from("trips")
    .insert({ owner_id: user.id, slug, title: body.data.title ?? "Weekend away", trip_date: body.data.tripDate ?? null })
    .select("id, slug")
    .single();
  if (error) return apiError("server_error", error.message, 500);

  const seed = preset ? tripReducer(emptyTrip(), { type: "group/load", preset, replace: true }) : defaultTrip();
  if (seed.units.length) {
    const { error: uErr } = await admin.from("trip_units").insert(
      seed.units.map((u) => ({ id: u.id, trip_id: trip.id, kind: u.kind, name: u.name, color: u.color, sort: u.sort, payid: u.payid })),
    );
    if (uErr) return apiError("server_error", uErr.message, 500);
    const { error: mErr } = await admin
      .from("trip_members")
      .insert(seed.members.map((m) => ({ id: m.id, trip_id: trip.id, unit_id: m.unitId, name: m.name, sort: m.sort })));
    if (mErr) return apiError("server_error", mErr.message, 500);
  }

  return NextResponse.json({ id: trip.id, slug: trip.slug });
}
