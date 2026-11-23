import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, zodMessage } from "@/lib/api";
import { PRODUCTS } from "@/lib/plans";
import { getStripe } from "@/lib/stripe";
import { appUrl } from "@/lib/supabase/config";
import { getAdminSupabase, getUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BodyZ = z.discriminatedUnion("product", [
  z.object({ product: z.literal("trip_pass"), tripId: z.string().uuid() }),
  z.object({ product: z.literal("pro"), tripId: z.string().uuid().optional() }),
]);

export async function POST(req: Request) {
  const body = BodyZ.safeParse(await req.json().catch(() => null));
  if (!body.success) return apiError("bad_request", zodMessage(body.error), 400);
  if (!process.env.STRIPE_SECRET_KEY) return apiError("not_configured", "Payments are not configured yet", 503);

  const { user } = await getUser();
  if (!user) return apiError("unauthorized", "Sign in first", 401);
  if (user.is_anonymous || !user.email) {
    return apiError("needs_account", "Add your email first so we can attach the purchase to your account", 401);
  }

  const admin = getAdminSupabase();
  const { data: profile, error: pErr } = await admin.from("profiles").select("id, plan_tier, stripe_customer_id").eq("id", user.id).single();
  if (pErr) return apiError("server_error", pErr.message, 500);

  let tripSlug: string | null = null;
  if (body.data.tripId) {
    const { data: trip } = await admin.from("trips").select("id, slug, owner_id, is_unlocked").eq("id", body.data.tripId).maybeSingle();
    if (!trip || trip.owner_id !== user.id) return apiError("forbidden", "You can only unlock your own trips", 403);
    if (body.data.product === "trip_pass" && trip.is_unlocked) return apiError("bad_request", "This trip is already unlocked", 400);
    tripSlug = trip.slug;
  }
  if (body.data.product === "pro" && profile.plan_tier === "pro") return apiError("bad_request", "You're already on Pro Host", 400);

  const stripe = getStripe();
  let customerId = profile.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } });
    customerId = customer.id;
    await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const product = PRODUCTS[body.data.product];
  const metadata = { user_id: user.id, product: body.data.product, trip_id: body.data.tripId ?? "" };
  const back = tripSlug ? `${appUrl()}/trip/${tripSlug}` : `${appUrl()}/dashboard`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: product.mode,
      customer: customerId,
      client_reference_id: user.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: product.currency,
            unit_amount: product.amountCents,
            product_data: { name: `CoupleTab ${product.name}` },
            ...(product.mode === "subscription" ? { recurring: { interval: "month" as const } } : {}),
          },
        },
      ],
      metadata,
      ...(product.mode === "subscription" ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
      allow_promotion_codes: true,
      success_url: `${back}?upgraded=${body.data.product}`,
      cancel_url: back,
    });
    if (!session.url) return apiError("server_error", "Stripe did not return a checkout URL", 502);
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("stripe checkout failed", e);
    return apiError("server_error", e instanceof Error ? e.message : "Checkout failed", 502);
  }
}
