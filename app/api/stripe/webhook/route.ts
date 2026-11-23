import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getStripe } from "@/lib/stripe";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MetaZ = z.object({
  user_id: z.string().uuid(),
  product: z.enum(["trip_pass", "pro"]),
  trip_id: z.string().optional().transform((v) => (v ? v : null)),
});

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret) return apiError("not_configured", "STRIPE_WEBHOOK_SECRET is not configured", 503);
  if (!sig) return apiError("bad_request", "Missing stripe-signature header", 400);

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    return apiError("bad_request", `Invalid signature: ${e instanceof Error ? e.message : "unknown"}`, 400);
  }

  const admin = getAdminSupabase();
  // Idempotency: Stripe retries, so only process each event once.
  const { error: dupErr } = await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  if (dupErr) {
    if (dupErr.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    return apiError("server_error", dupErr.message, 500);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "unpaid") break;
        const meta = MetaZ.safeParse(session.metadata ?? {});
        if (!meta.success) {
          console.warn("checkout session without valid metadata", session.id);
          break;
        }
        await applyPurchase(admin, meta.data, session);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const active = event.type === "customer.subscription.updated" && ["active", "trialing", "past_due"].includes(sub.status);
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const { data: profile } = await admin.from("profiles").select("id, plan_tier").eq("stripe_customer_id", customerId).maybeSingle();
        if (!profile) break;
        if (active) {
          await admin.from("profiles").update({ plan_tier: "pro", stripe_subscription_id: sub.id }).eq("id", profile.id);
        } else if (profile.plan_tier === "pro") {
          // fall back to trip_pass if they ever bought a pass, else free
          const { count } = await admin.from("trips").select("id", { count: "exact", head: true }).eq("owner_id", profile.id).eq("is_unlocked", true);
          await admin
            .from("profiles")
            .update({ plan_tier: (count ?? 0) > 0 ? "trip_pass" : "free", stripe_subscription_id: null })
            .eq("id", profile.id);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    // let Stripe retry: forget the event so the retry is processed
    await admin.from("stripe_events").delete().eq("id", event.id);
    console.error("stripe webhook failed", e);
    return apiError("server_error", e instanceof Error ? e.message : "Webhook failed", 500);
  }

  return NextResponse.json({ received: true });
}

async function applyPurchase(
  admin: ReturnType<typeof getAdminSupabase>,
  meta: z.infer<typeof MetaZ>,
  session: Stripe.Checkout.Session,
) {
  const customerId = typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
  const { data: profile, error } = await admin.from("profiles").select("plan_tier").eq("id", meta.user_id).single();
  if (error) throw error;

  if (meta.product === "pro") {
    const subId = typeof session.subscription === "string" ? session.subscription : (session.subscription?.id ?? null);
    const { error: e } = await admin
      .from("profiles")
      .update({ plan_tier: "pro", stripe_subscription_id: subId, ...(customerId ? { stripe_customer_id: customerId } : {}) })
      .eq("id", meta.user_id);
    if (e) throw e;
    return;
  }

  if (!meta.trip_id) throw new Error("trip_pass purchase without trip_id");
  const { error: tErr } = await admin.from("trips").update({ is_unlocked: true }).eq("id", meta.trip_id).eq("owner_id", meta.user_id);
  if (tErr) throw tErr;
  if (profile.plan_tier === "free") {
    const { error: pErr } = await admin.from("profiles").update({ plan_tier: "trip_pass" }).eq("id", meta.user_id);
    if (pErr) throw pErr;
  }
}
