# CoupleTab

Couple-aware, multi-receipt bill splitting for weekends away. Snap every receipt, tap who had what, and send everyone their total plus who owes whom.

- **Couple = 1 share.** Tap `Couple (Whole)` to share an item as a couple, or tap one partner when only they had it. Partner shares roll up into the couple's total.
- **Many receipts, many payers.** Each receipt has its own surcharge (e.g. +10% weekend vs 0% cellar door) and a `Paid by`. Net settlement uses the fewest transfers, with PayID / BSB ready to copy.
- **Easy upload.** Drop a pile of photos or PDFs anywhere on the page, paste a screenshot, or use the phone camera. Photos are shrunk in the browser, read by Gemini 2.5 Flash with structured output, multi-quantity rows are split into portions (`3x Crab $114` → three `Crab (n of 3)` at $38), and duplicate guest bills / tax invoices / EFTPOS slips are flagged and left out of the totals.
- **Live table.** Unlocked trips get a share link; anyone with it can tap their own chips from their phone without signing up (Supabase Realtime).
- **Freemium.** Free: 1 active trip, 2 AI scans per trip, 1 saved group. Weekend Trip Pass ($4.99 AUD once) or Pro Host ($9 AUD/month) via Stripe Checkout.

Stack: Next.js 15 (App Router, TypeScript), Tailwind CSS 4 with shadcn-style components, Supabase (Auth, Postgres, Storage, Realtime), `@google/genai`, Stripe, Zod.

## Run it locally (one command)

You need **Node.js 20 or newer** (`node -v` to check; install from https://nodejs.org or `brew install node`).

```bash
git clone https://github.com/onats/coupletab.git
cd coupletab
./start.sh            # or: npm run local
```

`start.sh` installs dependencies on the first run, creates `.env.local` from `.env.example`, starts the app and opens http://localhost:3000.

Then try it:

1. On the landing page click **Sign up free**, enter a name, email and password (8+ characters).
2. You land on **My trip tabs**. Click **Start my first trip**.
3. Rename the trip, edit the couples, add receipts with **Type one in** (or drop photos once `GEMINI_API_KEY` is set), and tap who had what.
4. Log out and back in: your trips are still there. A second account can't open them.

To turn on receipt scanning, put a free key from https://aistudio.google.com/apikey into `GEMINI_API_KEY` in `.env.local`, then stop the server (Ctrl+C) and run `./start.sh` again.

### Modes

| Supabase keys in `.env.local` | Sign-up / login | Where trips are stored |
| --- | --- | --- |
| Blank (default) | **Local accounts**: email + password, hashed with scrypt, signed session cookie | JSON files in `.data/` on this computer |
| Filled in | Supabase Auth: magic link, Google, anonymous start | Supabase Postgres, with live table links and Stripe upgrades |

`/local` is a no-account demo in either mode (data stays in the browser). Delete `.data/` to wipe all local accounts and trips.

Local accounts mode is for testing and demos on one machine. For real customers, use Supabase (below).

## Full setup

1. **Supabase**: create a project, then apply the migration (`supabase link` + `supabase db push`, or paste `supabase/migrations/001_init.sql` into the SQL editor). It creates the tables, RLS policies, the private `receipts` storage bucket and the Realtime publication.
   - Authentication → Providers: enable **Email** (magic link), **Google**, and **Anonymous sign-ins** (lets people start a tab without signing up; they can add an email later and keep the trip). Consider turning on CAPTCHA for anonymous sign-ins.
   - Authentication → URL configuration: add `<APP_URL>/auth/callback` to the redirect URLs.
2. **Gemini**: create a key at https://aistudio.google.com/apikey.
3. **Stripe**: no products need to be created (prices are defined inline in `lib/plans.ts`). Point a webhook at `<APP_URL>/api/stripe/webhook` with events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`. Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
4. Fill in `.env.local` (see `.env.example`).

## Scripts

```bash
npm run local      # one-command start (install, .env.local, dev server)
npm run dev        # dev server only
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
| `lib/local/*`, `app/api/account/*`, `app/api/local-trips/*` | Local accounts mode: users, sessions and trips stored in `.data/` |

**Guest access model:** guests send the trip's join token as an `x-join-token` header; RLS reads it via `request.headers` and grants read access plus chip toggling (`item_assignments` insert/delete) on unlocked trips or Pro hosts' trips. Only the host edits receipts, items and people. Plan and unlock columns are writable only by the service role.
