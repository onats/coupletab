# CoupleTab

Couple-aware, multi-receipt bill splitting for weekends away. Snap every receipt, tap who had what, and send everyone their total plus who owes whom.

- **Couple = 1 share.** Tap `Couple (Whole)` to share an item as a couple, or tap one partner when only they had it. Partner shares roll up into the couple's total.
- **Many receipts, many payers.** Each receipt has its own surcharge (e.g. +10% weekend vs 0% cellar door) and a `Paid by`. Net settlement uses the fewest transfers, with PayID / BSB ready to copy.
- **Easy upload.** Drop a pile of photos or PDFs anywhere on the page, paste a screenshot, or use the phone camera. Photos are shrunk in the browser, read by Gemini 2.5 Flash with structured output, multi-quantity rows are split into portions (`3x Crab $114` → three `Crab (n of 3)` at $38), and duplicate guest bills / tax invoices / EFTPOS slips are flagged and left out of the totals.
- **Live table.** Unlocked trips get a share link; anyone with it can tap their own chips from their phone without signing up (Supabase Realtime).
- **Freemium.** Free: 1 active trip, 2 AI scans per trip, 1 saved group. Weekend Trip Pass ($4.99 AUD once) or Pro Host ($9 AUD/month) via Stripe Checkout.

Stack: Next.js 15 (App Router, TypeScript), Tailwind CSS 4 with shadcn-style components, Supabase (Auth, Postgres, Storage, Realtime), `@google/genai`, Stripe, Zod.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

With no Supabase keys the app runs in **demo mode** at `/local`: everything is stored in your browser, and receipt scanning works as soon as `GEMINI_API_KEY` is set.

## Full setup

1. **Supabase**: create a project, then apply the migration (`supabase link` + `supabase db push`, or paste `supabase/migrations/001_init.sql` into the SQL editor). It creates the tables, RLS policies, the private `receipts` storage bucket and the Realtime publication.
   - Authentication → Providers: enable **Email** (magic link), **Google**, and **Anonymous sign-ins** (lets people start a tab without signing up; they can add an email later and keep the trip). Consider turning on CAPTCHA for anonymous sign-ins.
   - Authentication → URL configuration: add `<APP_URL>/auth/callback` to the redirect URLs.
2. **Gemini**: create a key at https://aistudio.google.com/apikey.
3. **Stripe**: no products need to be created (prices are defined inline in `lib/plans.ts`). Point a webhook at `<APP_URL>/api/stripe/webhook` with events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`. Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
4. Fill in `.env.local` (see `.env.example`).

## Scripts

```bash
npm run dev        # local dev server
npm run typecheck  # tsc --noEmit
npm test           # split engine, OCR normalisation and duplicate detection tests
npm run build      # production build
```

## How it fits together

| Path | What it does |
| --- | --- |
| `lib/split.ts` | Pure split engine: shares, proportional surcharge, per-couple breakdown, net settlement |
| `lib/trip-reducer.ts` | All edits as reducer actions (shared by demo mode and Supabase mode) |
| `lib/receipt-schema.ts`, `lib/gemini.ts` | Gemini `responseSchema`, Zod validation, quantity expansion |
| `lib/dedupe.ts` | Duplicate receipt detection (shared receipt numbers, guest bill vs tax invoice, card slips) |
| `lib/use-trip-store.ts` | Optimistic store: debounced diff-based writes to Supabase + Realtime refresh |
| `app/api/parse-receipt` | Auth + quota check, upload to Storage, OCR, dedupe, insert |
| `app/api/trips` | Creates a trip (free-tier limit enforced server-side) |
| `app/api/stripe/checkout`, `app/api/stripe/webhook` | Trip Pass / Pro checkout, updates `trips.is_unlocked` and `profiles.plan_tier` |
| `supabase/migrations/001_init.sql` | Schema, RLS, storage bucket, Realtime |

**Guest access model:** guests send the trip's join token as an `x-join-token` header; RLS reads it via `request.headers` and grants read access plus chip toggling (`item_assignments` insert/delete) on unlocked trips or Pro hosts' trips. Only the host edits receipts, items and people. Plan and unlock columns are writable only by the service role.
