"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
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
      <section className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
          Music School
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Use your Google account to continue.
        </p>
        {error ? (
          <p className="mt-5 rounded-lg border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-300">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={signIn}
          disabled={pending}
          className="mt-7 w-full rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-wait disabled:opacity-60"
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
