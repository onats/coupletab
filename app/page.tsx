import { ArrowRight, Camera, Check, Copy, HeartHandshake, Percent, Receipt, ShieldCheck, Smartphone, Sparkles, Users } from "lucide-react";
import Link from "next/link";

const steps = [
  { icon: Camera, title: "Snap every receipt", body: "Drop a pile of photos, PDFs or screenshots at once. CoupleTab reads each one, splits “3x Crab” into three portions and skips the duplicate tax invoice." },
  { icon: HeartHandshake, title: "Tap who had what", body: "One tap gives an item to a whole couple (1 share). Tap a partner instead when only they had the wine. It all rolls up to the couple." },
  { icon: Copy, title: "Settle in one message", body: "Surcharges, who paid which bill, and the fewest transfers to square up, with PayID ready to paste into the group chat." },
];

const features = [
  { icon: Users, title: "Couples count as one", body: "Most splitters treat everyone as a single. CoupleTab knows Sam & Jo share a plate, and still lets Jo pay for her own cocktail." },
  { icon: Receipt, title: "Many bills, many payers", body: "Lunch on one card, dinner on another, the winery on a third. Each receipt keeps its own payer and the app nets it all out." },
  { icon: Percent, title: "Surcharges done right", body: "Weekend 10%, card fees, service charges. Applied in proportion to what each person actually had, not split evenly." },
  { icon: ShieldCheck, title: "No double counting", body: "Guest bill, tax invoice and EFTPOS slip for the same meal? Duplicates are flagged and left out of the totals automatically." },
];

const faqs = [
  { q: "Does everyone need an account?", a: "No. Only the person holding the receipts signs up. Everyone else just gets their total, or taps their own items from a shared link on a paid trip." },
  { q: "What does the free plan include?", a: "One active trip tab with unlimited manual receipts and two AI receipt scans. Upgrade a single weekend for $4.99, or go Pro if you host often." },
  { q: "Does it work on my phone?", a: "Yes. Open it in your phone's browser and use the camera straight from the upload button. There is no app to install." },
  { q: "Can I try it without signing up?", a: "Yes. The demo keeps everything in your browser so you can play with a real split before creating an account." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-700 text-white">
              <HeartHandshake className="h-4 w-4" />
            </span>
            CoupleTab
          </Link>
          <nav className="flex items-center gap-2 text-sm sm:gap-4">
            <a href="#pricing" className="hidden text-slate-600 hover:text-slate-900 sm:inline">
              Pricing
            </a>
            <a href="#faq" className="hidden text-slate-600 hover:text-slate-900 sm:inline">
              FAQ
            </a>
            <Link href="/login" className="px-2 py-1.5 font-medium text-slate-700 hover:text-slate-900">
              Log in
            </Link>
            <Link href="/signup" className="rounded-lg bg-blue-700 px-3 py-1.5 font-semibold text-white shadow-sm hover:bg-blue-800">
              Sign up free
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 sm:pt-20 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
              <Sparkles className="h-3.5 w-3.5" /> Reads your receipts for you
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Split the weekend bill the way couples actually share.</h1>
            <p className="mt-4 text-lg text-slate-600">
              Restaurant, cellar door, creperie: snap them all, tap who had what, and send everyone their total. Couples count as one share, unless only one of you had the oysters.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex h-12 items-center gap-2 rounded-xl bg-blue-700 px-6 text-base font-semibold text-white shadow-sm hover:bg-blue-800">
                Create free account <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/local" className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-base font-medium hover:bg-slate-50">
                Try the demo
              </Link>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
              <Smartphone className="h-4 w-4" /> Free to start. Works on your phone camera, no app to install.
            </p>
          </div>
          <HeroMock />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-sm font-semibold tracking-wide text-blue-700 uppercase">How it works</h2>
        <p className="mt-2 text-center text-3xl font-bold">Three taps from receipt pile to settled.</p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-blue-700 shadow-sm">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold text-slate-400">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-3xl font-bold">Built for the group trip, not the flatshare.</p>
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="flex gap-4">
                <f.icon className="mt-1 h-6 w-6 shrink-0 text-blue-300" />
                <div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-300">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-16 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold">Simple pricing</h2>
          <p className="mt-2 text-slate-600">Start free. Pay only for the weekends that need it.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Plan name="Free" price="$0" cta="Sign up free" features={["1 active trip tab", "2 AI receipt scans per trip", "Unlimited manual receipts", "Copy summary to WhatsApp"]} />
            <Plan name="Weekend Trip Pass" price="$4.99" unit="AUD once" highlight cta="Start a trip" features={["Unlimited receipt scans on one trip", "Live table link: everyone taps their own items", "Unlimited saved groups"]} />
            <Plan name="Pro Host" price="$9" unit="AUD / month" cta="Start with Pro" features={["Every trip unlocked", "Unlimited active trips", "Unlimited saved groups", "Cancel any time"]} />
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-16 px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-bold">Questions</h2>
        <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
          {faqs.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {f.q}
                <span className="text-slate-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-blue-700 p-8 text-white sm:flex-row sm:items-center sm:p-10">
          <div>
            <p className="text-2xl font-bold">Back from the weekend with a wallet full of receipts?</p>
            <p className="mt-1 text-blue-100">Sort it out before the group chat goes quiet.</p>
          </div>
          <Link href="/signup" className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-white px-6 font-semibold text-blue-800 hover:bg-blue-50">
            Create free account <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500 sm:px-6">
          <span>© {new Date().getFullYear()} CoupleTab</span>
          <span className="flex gap-4">
            <Link href="/login" className="hover:text-slate-800">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-slate-800">
              Sign up
            </Link>
            <Link href="/local" className="hover:text-slate-800">
              Demo
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

function HeroMock() {
  const rows = [
    { label: "Oysters (1 of 2)", who: "Sam & Jo", price: "$24.00", color: "bg-rose-100 text-rose-800" },
    { label: "Oysters (2 of 2)", who: "Alex & Kim", price: "$24.00", color: "bg-sky-100 text-sky-800" },
    { label: "Pinot noir", who: "Jo", price: "$16.00", color: "bg-rose-50 text-rose-700" },
    { label: "Crab linguine", who: "Priya", price: "$38.00", color: "bg-amber-100 text-amber-800" },
  ];
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-4 -z-10 rotate-3 rounded-3xl bg-blue-200/40" />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Saturday dinner · +10% weekend</div>
            <div className="font-semibold">The Wharf Kitchen</div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Paid by Alex & Kim</span>
        </div>
        <ul className="mt-4 space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-2">
              <span className="truncate">{r.label}</span>
              <span className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.color}`}>{r.who}</span>
                <span className="tabular w-16 text-right text-slate-600">{r.price}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-xl bg-slate-900 p-4 text-sm text-white">
          <div className="text-xs text-slate-400">Settle up</div>
          <div className="mt-1 flex justify-between">
            <span>Sam & Jo → Alex & Kim</span>
            <b>$44.00</b>
          </div>
          <div className="flex justify-between">
            <span>Priya → Alex & Kim</span>
            <b>$41.80</b>
          </div>
        </div>
      </div>
    </div>
  );
}

function Plan({ name, price, unit, features, highlight, cta }: { name: string; price: string; unit?: string; features: string[]; highlight?: boolean; cta: string }) {
  return (
    <div className={`flex flex-col rounded-2xl border bg-white p-6 ${highlight ? "border-blue-600 ring-2 ring-blue-600/20" : "border-slate-200"}`}>
      {highlight && <span className="mb-2 self-start rounded-full bg-blue-700 px-2 py-0.5 text-xs font-semibold text-white">Most popular</span>}
      <div className="font-semibold">{name}</div>
      <div className="mt-2 text-3xl font-bold">
        {price} {unit && <span className="text-sm font-normal text-slate-500">{unit}</span>}
      </div>
      <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" /> {f}
          </li>
        ))}
      </ul>
      <Link
        href="/signup"
        className={`mt-6 inline-flex h-10 items-center justify-center rounded-lg text-sm font-semibold ${highlight ? "bg-blue-700 text-white hover:bg-blue-800" : "border border-slate-300 hover:bg-slate-50"}`}
      >
        {cta}
      </Link>
    </div>
  );
}
