"use client";

import { useActionState } from "react";
import { unlockUnsubmittedBillingPeriod } from "./actions";

const initialState = { ok: false, message: "" };

export function BillingPeriodUnlock({ schoolId, billingAccountId, billingPeriodId }: {
  schoolId: string; billingAccountId: string; billingPeriodId: string;
}) {
  const [state, action, pending] = useActionState(async () => unlockUnsubmittedBillingPeriod(schoolId, billingAccountId, billingPeriodId), initialState);
  return <form action={action} className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5"><div><p className="text-sm">Need to change the locked total?</p><p className="mt-1 text-xs text-muted">No approval has been sent. Unlocking preserves every line and returns this period to review.</p></div><button disabled={pending} className="line-action pb-2 text-sm text-brand disabled:opacity-50">{pending ? "Unlocking…" : "Unlock to revise"}</button>{state.message ? <p role="status" className={`basis-full text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}</form>;
}
