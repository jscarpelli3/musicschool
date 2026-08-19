"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PortalAuth() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function sendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await createClient().auth.signInWithOtp({ email: normalizedEmail, options: { shouldCreateUser: true } });
    setPending(false);
    if (error) {
      setMessage("We could not send a sign-in code. Wait a moment and try again.");
      return;
    }
    setEmail(normalizedEmail);
    setStep("code");
    setMessage("If this email can receive portal access, a one-time code is on its way.");
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const { error } = await createClient().auth.verifyOtp({ email, token: code.replace(/\s/g, ""), type: "email" });
    setPending(false);
    if (error) {
      setMessage("That code is invalid or expired. Check the code or request a new one.");
      return;
    }
    router.refresh();
  }

  return <section className="mx-auto w-full max-w-md border-t border-line pt-8">
    <p className="text-sm text-brand">Family scheduling</p>
    <h1 className="mt-6 font-display text-5xl leading-none">Your lessons.</h1>
    <p className="mt-5 text-sm leading-6 text-muted">Use the email address your school has on file. We will send a one-time code—no password required.</p>
    {step === "email" ? <form onSubmit={sendCode} className="mt-10 space-y-6">
      <label className="block"><span className="text-xs text-muted">Email address</span><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full border-b border-line bg-transparent py-3 outline-none focus:border-brand" /></label>
      <button disabled={pending} className="w-full border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:opacity-50">{pending ? "Sending…" : "Send one-time code"}</button>
    </form> : <form onSubmit={verifyCode} className="mt-10 space-y-6">
      <div><p className="text-xs text-muted">Code sent to</p><p className="mt-2 text-sm">{email}</p></div>
      <label className="block"><span className="text-xs text-muted">One-time code</span><input inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={8} value={code} onChange={(event) => setCode(event.target.value)} className="mt-2 w-full border-b border-line bg-transparent py-3 text-2xl tracking-[0.25em] outline-none focus:border-brand" /></label>
      <button disabled={pending} className="w-full border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:opacity-50">{pending ? "Checking…" : "Open my lessons"}</button>
      <button type="button" onClick={() => { setStep("email"); setCode(""); setMessage(""); }} className="w-full text-sm text-muted">Use a different email</button>
    </form>}
    {message ? <p role="status" className="mt-6 border-l-2 border-brand pl-4 text-sm leading-6 text-muted">{message}</p> : null}
  </section>;
}
