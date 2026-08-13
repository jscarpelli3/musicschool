"use client";

import { useActionState } from "react";
import { updateBillingContactEmail, type BillingContactEmailState } from "./actions";

const initialState: BillingContactEmailState = { ok: false, message: "" };

export function BillingContactEmail({ schoolId, billingAccountId, email }: { schoolId: string; billingAccountId: string; email: string }) {
  const [state, action, pending] = useActionState(updateBillingContactEmail.bind(null, schoolId, billingAccountId), initialState);
  return (
    <form action={action} className="mt-6 flex max-w-xl flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1">
        <span className="text-xs text-muted">Payer email</span>
        <input name="email" type="email" required defaultValue={email} autoComplete="email" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" />
      </label>
      <button disabled={pending} className="border border-line px-5 py-2 text-sm transition hover:border-brand hover:text-brand disabled:opacity-50">{pending ? "Saving…" : "Save email"}</button>
      {state.message ? <p role="status" className={`text-sm sm:basis-full ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}
    </form>
  );
}
