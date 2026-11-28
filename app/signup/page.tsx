"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { LocalAuthForm } from "@/components/local/auth-form";
import { getBrowserSupabase } from "@/lib/supabase/client";

function Signup() {
  const params = useSearchParams();
  const router = useRouter();
  const nextRaw = params.get("next") ?? "/dashboard";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/dashboard";
  const supabase = !!getBrowserSupabase();
  // With Supabase, the magic-link page both creates accounts and signs people in.
  useEffect(() => {
    if (supabase) router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [supabase, router, next]);
  if (supabase) return null;
  return <LocalAuthForm mode="signup" next={next} />;
}

export default function SignupPage() {
  return (
    <Suspense>
      <Signup />
    </Suspense>
  );
}
