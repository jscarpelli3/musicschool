"use client";

import { useActionState } from "react";
import { retryBillingApprovalEmail, sendBillingApprovalEmail, type BillingApprovalEmailState } from "./actions";

const initialState: BillingApprovalEmailState = { ok: false, message: "" };

export function BillingApprovalEmail({ schoolId, billingAccountId, billingPeriodId, latestStatus, approvalStatus, approvedAt }: {
  schoolId: string; billingAccountId: string; billingPeriodId: string; latestStatus?: string; approvalStatus?: string; approvedAt?: string | null;
}) {
  const deliveryFailed = approvalStatus === "pending" && latestStatus === "failed";
  const [sendState, sendAction, sendPending] = useActionState(sendBillingApprovalEmail.bind(null, schoolId, billingAccountId, billingPeriodId), initialState);
  const [retryState, retryAction, retryPending] = useActionState(retryBillingApprovalEmail.bind(null, schoolId, billingAccountId, billingPeriodId), initialState);
  const state = deliveryFailed ? (retryState.message ? retryState : sendState) : sendState;
  return (
    <div className="mt-5 border border-line bg-surface/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[0.14em] text-brand">Payer approval</p><p className="mt-2 text-sm">{approvalStatus === "approved" ? "Approved · ready to collect" : approvalStatus === "pending" ? "Waiting for payer" : "Send the itemized amount by email"}</p><p className="mt-1 text-xs text-muted">{approvalStatus === "approved" && approvedAt ? `Approved ${new Date(approvedAt).toLocaleString()}` : latestStatus ? <>Email delivery: <span className="uppercase text-brand">{latestStatus}</span></> : "No approval request has been sent."}</p></div>
        {approvalStatus !== "approved" ? <div className="flex flex-wrap gap-3">{deliveryFailed ? <form action={retryAction}><button type="submit" disabled={retryPending || sendPending} className="border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:cursor-wait disabled:opacity-50">{retryPending ? "Retrying…" : "Retry original email"}</button></form> : null}<form action={sendAction}><button type="submit" disabled={retryPending || sendPending} className={`${deliveryFailed ? "border-b border-muted px-2" : "border border-brand px-5"} py-3 text-sm text-brand transition hover:border-brand disabled:cursor-wait disabled:opacity-50`}>{sendPending ? "Sending…" : deliveryFailed ? "Send to updated payer email" : approvalStatus === "pending" ? "Replace approval link" : "Email approval request"}</button></form></div> : <span className="border-l-2 border-brand pl-4 text-sm text-brand">Collection has not started</span>}
      </div>
      {approvalStatus === "pending" ? <p className="mt-4 max-w-xl text-xs leading-5 text-muted">{deliveryFailed ? "Retry original email keeps this exact request and recipient. If you corrected the payer address, send to the updated email instead; that cancels the unreachable link and creates a replacement for the same locked amount." : "Replacing the link cancels the current pending request so only the newest exact amount can be approved."}</p> : null}
      {state.message ? <p role="status" className={`mt-4 text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}
    </div>
  );
}
