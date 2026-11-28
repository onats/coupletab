"use client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { readApiError } from "@/lib/utils";

/** Email + password sign-up / log-in for local accounts mode (no Supabase configured). */
export function LocalAuthForm({ mode, next }: { mode: "signup" | "login"; next: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signup = mode === "signup";
  const other = `${signup ? "/login" : "/signup"}${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(signup ? "/api/account/signup" : "/api/account/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(signup ? { name, email, password } : { email, password }),
    }).catch(() => null);
    if (!res) {
      setError("Couldn't reach the server.");
      setBusy(false);
      return;
    }
    if (!res.ok) {
      setError((await readApiError(res)).message);
      setBusy(false);
      return;
    }
    router.replace(signup && next === "/dashboard" ? "/dashboard?welcome=1" : next);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white px-4">
      <Card className="mx-auto max-w-md translate-y-12 p-6 sm:translate-y-20 sm:p-8">
        <Link href="/" className="text-sm font-bold text-blue-700">
          CoupleTab
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{signup ? "Create your free account" : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {signup ? "Your trips are saved to your account so you can come back to them any time." : "Log in to open your trip tabs."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          {signup && (
            <label className="block text-sm font-medium">
              Your name
              <Input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-11" placeholder="Alex" />
            </label>
          )}
          <label className="block text-sm font-medium">
            Email
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-11"
              placeholder="you@example.com"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <Input
              type="password"
              required
              minLength={signup ? 8 : undefined}
              autoComplete={signup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-11"
              placeholder={signup ? "At least 8 characters" : ""}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {signup ? "Create account" : "Log in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          {signup ? "Already have an account? " : "New to CoupleTab? "}
          <Link href={other} className="font-medium text-blue-700 hover:underline">
            {signup ? "Log in" : "Create a free account"}
          </Link>
        </p>
      </Card>
    </div>
  );
}
