"use client";

import { useActionState } from "react";
import { sendBillingStatementNotice, type BillingStatementNoticeState } from "./actions";

const initialState: BillingStatementNoticeState = { ok: false, message: "" };

export function BillingStatementNotice({ schoolId, billingAccountId, billingPeriodId, readiness, noticeDays }: {
  schoolId: string;
  billingAccountId: string;
  billingPeriodId: string;
  readiness: string;
  noticeDays: number;
}) {
  const [state, action, pending] = useActionState(sendBillingStatementNotice.bind(null, schoolId, billingAccountId, billingPeriodId), initialState);
  const canSend = readiness === "notice_required" || readiness === "notice_failed";
  const copy = readiness === "notice_pending" ? "Statement email accepted; waiting for verified delivery."
    : readiness === "notice_waiting" ? `Statement delivered. The ${noticeDays}-day notice period is still running.`
      : readiness === "ready" ? "Advance notice is complete. This statement is eligible for the future charge queue."
        : readiness === "notice_failed" ? "Statement delivery failed. Retry the same locked statement before collection."
          : `Send the itemized statement at least ${noticeDays} day(s) before collection.`;
  return <div className="mt-5 border-t border-line pt-5">
    <p className="text-sm">Automatic-payment notice</p>
    <p className="mt-2 max-w-xl text-xs leading-5 text-muted">{copy}</p>
    {canSend ? <form action={action} className="mt-4"><button disabled={pending} className="border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:opacity-50">{pending ? "Sending statement…" : readiness === "notice_failed" ? "Retry statement email" : "Send advance statement"}</button></form> : null}
    {state.message ? <p role="status" className={`mt-3 text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}
  </div>;
}
