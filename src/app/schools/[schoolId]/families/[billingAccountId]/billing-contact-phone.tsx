"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateBillingContactPhone, type BillingContactPhoneState } from "./actions";

const initialState: BillingContactPhoneState = { ok: false, message: "" };

export function BillingContactPhone({ schoolId, schoolName, billingAccountId, phone, consentState }: {
  schoolId: string;
  schoolName: string;
  billingAccountId: string;
  phone: string;
  consentState: string;
}) {
  const [state, action, pending] = useActionState(
    updateBillingContactPhone.bind(null, schoolId, billingAccountId),
    initialState,
  );
  const consentLabel = consentState === "opted_in" ? "Texting enrolled"
    : consentState === "opted_out" ? "Texting stopped" : "Not enrolled for texts";

  return (
    <div className="mt-6 max-w-xl border-t border-line pt-5">
      <form action={action} className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="text-xs text-muted">Payer mobile number</span>
          <input name="phone" type="tel" required defaultValue={phone} autoComplete="tel" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" />
        </label>
        <button disabled={pending} className="border border-line px-5 py-2 text-sm transition hover:border-brand hover:text-brand disabled:opacity-50">
          {pending ? "Saving…" : "Save number"}
        </button>
      </form>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className={consentState === "opted_in" ? "text-brand" : consentState === "opted_out" ? "text-danger" : "text-muted"}>{consentLabel}</span>
        {consentState === "not_enrolled" ? <Link href={`/sms-consent?school=${encodeURIComponent(schoolName)}`} className="line-action pb-1 text-brand">Open payer consent form</Link> : null}
        {consentState === "opted_out" ? <span className="text-muted">The payer must text START or UNSTOP.</span> : null}
      </div>
      {state.message ? <p role="status" className={`mt-3 text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}
    </div>
  );
}
