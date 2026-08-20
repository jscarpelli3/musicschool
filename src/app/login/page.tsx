"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CommonTimeLogo } from "@/components/brand/common-time-logo";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth" ? "Google sign-in could not be completed." : null,
  );
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    setError(null);

    const supabase = createClient();
    const callback = new URL("/auth/callback", window.location.origin);
    const next = searchParams.get("next");
    if (next?.startsWith("/") && !next.startsWith("//")) {
      callback.searchParams.set("next", next);
    }

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
        queryParams: { prompt: "select_account" },
      },
    });

    if (authError) {
      setError(authError.message);
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-20">
      <section className="w-full max-w-sm border-t border-line pt-8">
        <CommonTimeLogo priority className="w-64 max-w-full" />
        <h1 className="mt-6 font-display text-5xl font-normal tracking-[-0.035em]">Welcome back.</h1>
        <p className="mt-4 text-sm leading-6 text-muted">
          Use your Google account to continue.
        </p>
        {error ? (
          <p className="mt-5 border-l-2 border-danger py-2 pl-4 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={signIn}
          disabled={pending}
          className="mt-10 w-full rounded-control bg-ink px-4 py-3 text-sm font-medium text-canvas transition hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Redirecting…" : "Continue with Google"}
        </button>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
