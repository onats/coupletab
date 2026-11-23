import type { PlanTier } from "./types";

export const FREE_ACTIVE_TRIPS = 1;
export const FREE_SCANS_PER_TRIP = 2;
export const FREE_SAVED_GROUPS = 1;

export const PRODUCTS = {
  trip_pass: { name: "Weekend Trip Pass", amountCents: 499, currency: "aud", mode: "payment" as const },
  pro: { name: "Pro Host", amountCents: 900, currency: "aud", mode: "subscription" as const },
};
export type ProductKey = keyof typeof PRODUCTS;

export const isPaid = (tier: PlanTier | null | undefined) => tier === "trip_pass" || tier === "pro";
