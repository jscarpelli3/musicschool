"use client";

import { useActionState, useState } from "react";
import { updateBillingContactEmail, type BillingContactEmailState } from "./actions";

const initialState: BillingContactEmailState = { ok: false, message: "" };

export function BillingContactEmail({ schoolId, billingAccountId, email, hasPendingApproval }: { schoolId: string; billingAccountId: string; email: string; hasPendingApproval: boolean }) {
  const [state, action, pending] = useActionState(updateBillingContactEmail.bind(null, schoolId, billingAccountId), initialState);
  const [nextEmail, setNextEmail] = useState(email);
  const changesAddress = nextEmail.trim().toLowerCase() !== email.trim().toLowerCase();
  return (
    <form action={action} onSubmit={(event) => { if (hasPendingApproval && changesAddress && !window.confirm("Changing this email address will invalidate the pending approval link. You will need to send the approval request again to the new address. Continue?")) event.preventDefault(); }} className="mt-6 flex max-w-xl flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1">
        <span className="text-xs text-muted">Payer email</span>
        <input name="email" type="email" required value={nextEmail} onChange={(event) => setNextEmail(event.target.value)} autoComplete="email" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" />
      </label>
      <button disabled={pending} className="border border-line px-5 py-2 text-sm transition hover:border-brand hover:text-brand disabled:opacity-50">{pending ? "Saving…" : "Save email"}</button>
      {hasPendingApproval && changesAddress ? <p className="text-xs leading-5 text-danger sm:basis-full">Changing this address invalidates the pending approval link. After saving, send the approval request again to the new address.</p> : null}
      {state.message ? <p role="status" className={`text-sm sm:basis-full ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}
    </form>
  );
}
