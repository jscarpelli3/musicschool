"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CommonTimeLogo } from "@/components/brand/common-time-logo";
import { requestEmailCode, verifyEmailCode } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/client";
import { PendingActionStatus } from "@/components/ui/pending-action-status";

function LoginForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth" ? "Google sign-in could not be completed." : null,
  );
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  const safeNext = () => {
    const value = searchParams.get("next");
    return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
  };

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

  async function sendCode() {
    setPending(true);
    setError(null);
    const normalized = email.trim().toLowerCase();
    let result;
    try { result = await requestEmailCode(normalized, "account"); }
    catch { setError("The request did not finish. Check your connection and try again."); setPending(false); return; }
    if (!result.ok) setError(result.message);
    else { setEmail(normalized); setCodeSent(true); }
    setPending(false);
  }

  async function verifyCode() {
    setPending(true);
    setError(null);
    let result;
    try { result = await verifyEmailCode(email, code, "account"); }
    catch { setError("Sign-in did not finish. Your code is still safe to try again."); setPending(false); return; }
    if (!result.ok) { setError(result.message); setPending(false); return; }
    window.location.assign(safeNext());
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-20">
      <section className="flex w-full max-w-sm flex-col items-center border-t border-line pt-8 text-center">
        <CommonTimeLogo priority className="w-64 max-w-full" />
        <h1 className="mt-6 font-display text-5xl font-normal tracking-[-0.035em]">Welcome back.</h1>
        <p className="mt-4 text-sm leading-6 text-muted">Use Google or a one-time email code. There is no password to remember.</p>
        {error ? (
          <p className="mt-5 w-full border-l-2 border-danger py-2 pl-4 text-left text-sm text-danger">
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
        <div className="my-7 flex w-full items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" /><span>or use email</span><span className="h-px flex-1 bg-line" /></div>
        {!codeSent ? <div className="w-full text-left"><label><span className="text-xs text-muted">Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full border-b border-line bg-transparent py-3 outline-none focus:border-brand" /></label><button type="button" onClick={sendCode} disabled={pending || !email.trim()} className="mt-5 w-full border border-brand px-4 py-3 text-sm text-brand disabled:cursor-wait disabled:opacity-50">{pending ? "Requesting code…" : "Email me a code"}</button><PendingActionStatus pending={pending} label="Requesting the sign-in email…" /></div> : <div className="w-full text-left"><p className="text-sm text-muted">Code sent to {email}</p><label className="mt-4 block"><span className="text-xs text-muted">Sign-in code</span><input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} className="mt-2 w-full border-b border-line bg-transparent py-3 text-center text-2xl tracking-[0.35em] outline-none focus:border-brand" /></label><button type="button" onClick={verifyCode} disabled={pending || code.replace(/\s/g, "").length < 6} className="mt-5 w-full border border-brand px-4 py-3 text-sm text-brand disabled:cursor-wait disabled:opacity-50">{pending ? "Opening account…" : "Continue"}</button><PendingActionStatus pending={pending} label="Verifying the code securely…"/><button type="button" onClick={() => { setCodeSent(false); setCode(""); setError(null); }} className="mt-3 w-full py-2 text-sm text-muted">Use a different email</button></div>}
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
