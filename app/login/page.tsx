"use client";
import { Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LocalAuthForm } from "@/components/local/auth-form";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useAccount } from "@/lib/use-account";

function Login() {
  const params = useSearchParams();
  const nextRaw = params.get("next") ?? "/dashboard";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/dashboard";
  const { user, isAnonymous, loading } = useAccount();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(params.get("error"));
  const sb = getBrowserSupabase();
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` : undefined;

  if (!sb) return <LocalAuthForm mode="login" next={next} />;

  // Anonymous users keep their trips by linking an email/Google identity instead of creating a new account.
  const linking = !!user && isAnonymous;

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setState("sending");
    const res = linking
      ? await sb.auth.updateUser({ email }, { emailRedirectTo: redirectTo })
      : await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (res.error) {
      setError(res.error.message);
      setState("idle");
    } else setState("sent");
  };

  const google = async () => {
    setError(null);
    const res = linking
      ? await sb.auth.linkIdentity({ provider: "google", options: { redirectTo } })
      : await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (res.error) setError(res.error.message);
  };

  return (
    <Card className="mx-auto mt-16 max-w-md p-6">
      <Link href="/" className="text-sm font-semibold text-slate-500">
        CoupleTab
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{linking ? "Save your tab" : "Sign in"}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {linking
          ? "Add your email to keep this trip, pay for upgrades and open it on any device."
          : params.get("reason") === "upgrade"
            ? "Sign in so we can attach your purchase to your account."
            : "We'll email you a magic link. No password needed."}
      </p>
      {!loading && user && !isAnonymous ? (
        <div className="mt-6 space-y-3 text-sm">
          <p>
            You&apos;re signed in as <b>{user.email}</b>.
          </p>
          <Link href={next}>
            <Button className="w-full">Continue</Button>
          </Link>
          <Button variant="ghost" className="w-full" onClick={() => sb.auth.signOut()}>
            Sign out
          </Button>
        </div>
      ) : state === "sent" ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <Mail className="mb-2 h-5 w-5" />
          Check <b>{email}</b> for a link. You can close this tab.
        </div>
      ) : (
        <>
          <Button variant="outline" size="lg" className="mt-6 w-full" onClick={google}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.7 2.3 2.4 6.6 2.4 12S6.7 21.7 12 21.7c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
            </svg>
            Continue with Google
          </Button>
          <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" /> or <div className="h-px flex-1 bg-slate-200" />
          </div>
          <form onSubmit={sendLink} className="space-y-3">
            <Input type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
            <Button type="submit" size="lg" className="w-full" disabled={state === "sending"}>
              {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
              Email me a magic link
            </Button>
          </form>
        </>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
