"use client";

import Link from "next/link";
import { useActionState } from "react";
import { recordSmsConsent, type SmsConsentState } from "./actions";

const initialState: SmsConsentState = { ok: false, message: "" };
const field = "mt-2 w-full border-b border-line bg-transparent py-3 outline-none transition focus:border-brand";

export function SmsConsentForm() {
  const [state, action, pending] = useActionState(recordSmsConsent, initialState);
  return (
    <form action={action} className="mt-10 border border-line bg-surface px-5 py-7 sm:px-8 sm:py-9">
      <div className="grid gap-7 sm:grid-cols-2">
        <label><span className="text-xs text-muted">Your name</span><input name="fullName" required maxLength={160} autoComplete="name" className={field} /></label>
        <label><span className="text-xs text-muted">Mobile phone</span><input name="phone" required type="tel" autoComplete="tel" placeholder="(555) 555-5555" className={field} /></label>
        <label className="sm:col-span-2"><span className="text-xs text-muted">Your music school</span><input name="schoolName" required maxLength={160} autoComplete="organization" className={field} /></label>
        <label className="absolute -left-[10000px]" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <label className="mt-8 flex items-start gap-4 border-t border-line pt-7 text-sm leading-6">
        <input name="smsConsent" value="yes" type="checkbox" className="mt-1.5 shrink-0 accent-[var(--color-brand)]" />
        <span>
          By checking this box and submitting this form, I consent to receive recurring transactional text messages from MusicSchool and the music school named above about lesson scheduling, billing approvals, payment status, reminders, and secure account access. Message frequency varies. Message and data rates may apply. Reply HELP for help or STOP to opt out. Consent is not a condition of purchase.
        </span>
      </label>

      <p className="mt-5 text-xs leading-5 text-muted">
        Review the <Link href="/terms" className="text-brand underline underline-offset-4">Terms of Service</Link> and <Link href="/privacy" className="text-brand underline underline-offset-4">Privacy Policy</Link>. SMS consent is separate from payment authorization and email preferences.
      </p>
      <button disabled={pending || state.ok} className="mt-8 w-full border border-brand px-5 py-4 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:opacity-50">
        {pending ? "Recording consent…" : state.ok ? "Consent recorded" : "Enroll in transactional texts"}
      </button>
      <p aria-live="polite" className={`mt-4 min-h-5 text-sm ${state.message && !state.ok ? "text-danger" : "text-muted"}`}>{state.message}</p>
    </form>
  );
}
