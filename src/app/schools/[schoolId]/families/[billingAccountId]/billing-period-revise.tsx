"use client";

import { useActionState } from "react";
import { reviseSubmittedBillingPeriod } from "./actions";

const initialState = { ok: false, message: "" };

export function BillingPeriodRevise({ schoolId, billingAccountId, billingPeriodId }: {
  schoolId: string; billingAccountId: string; billingPeriodId: string;
}) {
  const [state, action, pending] = useActionState(async () => reviseSubmittedBillingPeriod(schoolId, billingAccountId, billingPeriodId), initialState);
  return <form action={action} className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5"><div><p className="text-sm">Need to correct this proposal?</p><p className="mt-1 max-w-xl text-xs leading-5 text-muted">This cancels the current payer link before returning the unchanged statement to review. You will need to lock and send a new version.</p></div><button disabled={pending} className="line-action pb-2 text-sm text-brand disabled:opacity-50">{pending ? "Cancelling…" : "Revise and replace request"}</button>{state.message ? <p role="status" className={`basis-full text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}</form>;
}
