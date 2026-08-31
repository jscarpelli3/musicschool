"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CommonTimeLogo } from "@/components/brand/common-time-logo";
import { requestEmailCode, verifyEmailCode } from "@/app/auth/actions";
import { PendingActionStatus } from "@/components/ui/pending-action-status";

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
    let result;
    try { result = await requestEmailCode(normalizedEmail, "portal"); }
    catch { setPending(false); setMessage("The request did not finish. Check your connection and try again."); return; }
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setEmail(normalizedEmail);
    setStep("code");
    setMessage(result.message);
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    let result;
    try { result = await verifyEmailCode(email, code, "portal"); }
    catch { setPending(false); setMessage("Sign-in did not finish. Your code is still safe to try again."); return; }
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    router.refresh();
  }

  return <section className="mx-auto w-full max-w-md border-t border-line pt-8">
    <CommonTimeLogo priority className="w-56 max-w-full" />
    <p className="mt-5 text-sm text-brand">Family scheduling</p>
    <h1 className="mt-6 font-display text-5xl leading-none">Your lessons.</h1>
    <p className="mt-5 text-sm leading-6 text-muted">Use the email address your school has on file. We will send a one-time code—no password required.</p>
    {step === "email" ? <form onSubmit={sendCode} className="mt-10 space-y-6">
      <label className="block"><span className="text-xs text-muted">Email address</span><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full border-b border-line bg-transparent py-3 outline-none focus:border-brand" /></label>
      <button disabled={pending} className="w-full border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:cursor-wait disabled:opacity-50">{pending ? "Requesting your code…" : "Send one-time code"}</button><PendingActionStatus pending={pending} label="Checking your family access and requesting the email…" slowLabel="The email provider is taking longer than usual. Keep this page open; please do not request another code yet." />
    </form> : <form onSubmit={verifyCode} className="mt-10 space-y-6">
      <div><p className="text-xs text-muted">Code sent to</p><p className="mt-2 text-sm">{email}</p></div>
      <label className="block"><span className="text-xs text-muted">One-time code</span><input inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={8} value={code} onChange={(event) => setCode(event.target.value)} className="mt-2 w-full border-b border-line bg-transparent py-3 text-2xl tracking-[0.25em] outline-none focus:border-brand" /></label>
      <button disabled={pending} className="w-full border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:cursor-wait disabled:opacity-50">{pending ? "Opening your lessons…" : "Open my lessons"}</button><PendingActionStatus pending={pending} label="Verifying the code securely…" slowLabel="The code was submitted. Loading the family schedule is taking longer than usual; please keep this page open." />
      <button type="button" onClick={() => { setStep("email"); setCode(""); setMessage(""); }} className="w-full text-sm text-muted">Use a different email</button>
    </form>}
    {message ? <p role="status" className="mt-6 border-l-2 border-brand pl-4 text-sm leading-6 text-muted">{message}</p> : null}
  </section>;
}
