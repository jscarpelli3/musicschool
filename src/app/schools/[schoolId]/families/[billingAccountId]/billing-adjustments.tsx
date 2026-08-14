"use client";

import { useActionState, useRef } from "react";
import { addBillingAdjustment, removeBillingAdjustment, type BillingAdjustmentState } from "./actions";

const initialState: BillingAdjustmentState = { ok: false, message: "" };

export function BillingAdjustmentForm({ schoolId, billingAccountId, billingPeriodId }: {
  schoolId: string; billingAccountId: string; billingPeriodId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (previous: BillingAdjustmentState, formData: FormData) => {
    const result = await addBillingAdjustment(schoolId, billingAccountId, billingPeriodId, previous, formData);
    if (result.ok) formRef.current?.reset();
    return result;
  }, initialState);
  return (
    <details className="mt-5 border-t border-line pt-5">
      <summary className="cursor-pointer text-sm text-brand">Adjust this amount</summary>
      <form ref={formRef} action={action} className="mt-5 grid gap-5 sm:grid-cols-2">
        <label><span className="block text-xs text-muted">Adjustment</span><select name="kind" required defaultValue="charge" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand"><option value="charge">Add a charge</option><option value="credit">Apply a credit</option></select></label>
        <label><span className="block text-xs text-muted">Amount</span><span className="mt-2 flex border-b border-line focus-within:border-brand"><span className="py-2 text-muted">$</span><input name="amount" required inputMode="decimal" placeholder="0.00" className="min-w-0 flex-1 bg-transparent py-2 pl-1 outline-none" /></span></label>
        <label><span className="block text-xs text-muted">Category</span><select name="category" required defaultValue="" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand"><option value="" disabled>Select a category</option><option>Additional lesson</option><option>Materials</option><option>Registration or event</option><option>Courtesy adjustment</option><option>Billing correction</option><option>Other</option></select></label>
        <label><span className="block text-xs text-muted">Explanation · required</span><input name="description" required maxLength={300} placeholder="What changed and why?" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label>
        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-4"><p className="max-w-lg text-xs leading-5 text-muted">Adjustments become ordinary ledger lines and remain visible to the payer. Locking freezes them with the lesson charges.</p><button disabled={pending} className="border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:opacity-50">{pending ? "Saving…" : "Add adjustment"}</button></div>
        {state.message ? <p role="status" className={`sm:col-span-2 text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}
      </form>
    </details>
  );
}

export function BillingAdjustmentRemove({ schoolId, billingAccountId, billingPeriodId, adjustmentId }: {
  schoolId: string; billingAccountId: string; billingPeriodId: string; adjustmentId: string;
}) {
  return <form action={async () => { await removeBillingAdjustment(schoolId, billingAccountId, billingPeriodId, adjustmentId); }}><button className="line-action pb-1 text-xs text-muted hover:text-danger">Remove</button></form>;
}
