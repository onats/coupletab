import { ArrowRight, Camera, Check, HeartHandshake, Receipt, Smartphone } from "lucide-react";
import Link from "next/link";

const steps = [
  { icon: Camera, title: "Snap every receipt", body: "Drop a pile of photos, PDFs or screenshots at once. Gemini reads each one, splits “3x Crab” into three portions and skips the duplicate tax invoice." },
  { icon: HeartHandshake, title: "Tap who had what", body: "One tap gives an item to a whole couple (1 share). Tap a partner instead when only they had the wine. It all rolls up to the couple." },
  { icon: Receipt, title: "Settle in one message", body: "Proportional surcharges, who paid which bill, and the fewest transfers to square up, with PayID ready to copy into WhatsApp." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="text-lg font-bold">CoupleTab</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">
            My trips
          </Link>
          <Link href="/login" className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50">
            Sign in
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-blue-700 uppercase">For weekends away with friends</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Split the weekend bill the way couples actually share.</h1>
          <p className="mt-4 text-lg text-slate-600">
            Restaurant, cellar door, creperie: snap them all, tap who had what, and send everyone their total. Couples count as one share, unless only one of you had the oysters.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/new" className="inline-flex h-12 items-center gap-2 rounded-xl bg-blue-700 px-6 text-base font-semibold text-white shadow-sm hover:bg-blue-800">
              Start a tab <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/local" className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-300 px-6 text-base font-medium hover:bg-slate-50">
              Try without an account
            </Link>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
            <Smartphone className="h-4 w-4" /> Works on your phone camera. No app to install.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <s.icon className="h-6 w-6 text-blue-700" />
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold">Pricing</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Plan name="Free" price="$0" features={["1 active trip tab", "2 AI receipt scans per trip", "Unlimited manual receipts", "Copy summary to WhatsApp"]} />
            <Plan name="Weekend Trip Pass" price="$4.99" unit="AUD once" highlight features={["Unlimited receipt scans on one trip", "Live table link: everyone taps their own items", "Unlimited saved groups"]} />
            <Plan name="Pro Host" price="$9" unit="AUD / month" features={["Every trip unlocked", "Unlimited active trips", "Unlimited saved groups", "Cancel any time"]} />
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500 sm:px-6">© {new Date().getFullYear()} CoupleTab</footer>
    </div>
  );
}

function Plan({ name, price, unit, features, highlight }: { name: string; price: string; unit?: string; features: string[]; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white p-6 ${highlight ? "border-blue-600 ring-2 ring-blue-600/20" : "border-slate-200"}`}>
      <div className="font-semibold">{name}</div>
      <div className="mt-2 text-3xl font-bold">
        {price} {unit && <span className="text-sm font-normal text-slate-500">{unit}</span>}
      </div>
      <ul className="mt-4 space-y-2 text-sm text-slate-600">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" /> {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
