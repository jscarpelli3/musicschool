"use client";

import { useActionState } from "react";
import { retryBillingApprovalEmail, sendBillingApprovalEmail, type BillingApprovalEmailState } from "./actions";

const initialState: BillingApprovalEmailState = { ok: false, message: "" };

export function BillingApprovalEmail({ schoolId, billingAccountId, billingPeriodId, latestStatus, latestRecipientEmail, payerEmail, approvalStatus, approvedAt }: {
  schoolId: string; billingAccountId: string; billingPeriodId: string; latestStatus?: string; latestRecipientEmail?: string; payerEmail: string; approvalStatus?: string; approvedAt?: string | null;
}) {
  const deliveryFailed = approvalStatus === "pending" && latestStatus === "failed";
  const recipientChanged = Boolean(latestRecipientEmail) && latestRecipientEmail?.trim().toLowerCase() !== payerEmail.trim().toLowerCase();
  const [sendState, sendAction, sendPending] = useActionState(sendBillingApprovalEmail.bind(null, schoolId, billingAccountId, billingPeriodId), initialState);
  const [retryState, retryAction, retryPending] = useActionState(retryBillingApprovalEmail.bind(null, schoolId, billingAccountId, billingPeriodId), initialState);
  const useRetry = deliveryFailed && !recipientChanged;
  const state = useRetry ? (retryState.message ? retryState : sendState) : sendState;
  const approvalLabel = approvalStatus === "approved"
    ? "Approved · ready to collect"
    : deliveryFailed
      ? "Not delivered"
      : approvalStatus === "pending"
        ? "Waiting for payer"
        : "Send the itemized amount by email";
  return (
    <div className="mt-5 border border-line bg-surface/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[0.14em] text-brand">Payer approval</p><p className="mt-2 text-sm">{approvalLabel}</p><p className="mt-1 text-xs text-muted">{approvalStatus === "approved" && approvedAt ? `Approved ${new Date(approvedAt).toLocaleString()}` : deliveryFailed ? "The payer has not received an approval link." : latestStatus ? <>Email delivery: <span className="uppercase text-brand">{latestStatus}</span></> : "No approval request has been sent."}</p></div>
        {approvalStatus !== "approved" ? <form action={useRetry ? retryAction : sendAction}><button type="submit" disabled={retryPending || sendPending} className="border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:cursor-wait disabled:opacity-50">{retryPending || sendPending ? "Sending…" : deliveryFailed ? "Send approval email" : approvalStatus === "pending" ? "Replace approval link" : "Email approval request"}</button></form> : <span className="border-l-2 border-brand pl-4 text-sm text-brand">Approval received</span>}
      </div>
      {approvalStatus === "pending" ? <p className="mt-4 max-w-xl text-xs leading-5 text-muted">{deliveryFailed ? recipientChanged ? `The payer email changed. Sending will cancel the old link and deliver a replacement to ${payerEmail}.` : `Sending will retry this approval request to ${payerEmail}.` : "Replacing the link cancels the current pending request so only the newest exact amount can be approved."}</p> : null}
      {state.message ? <p role="status" className={`mt-4 text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}
    </div>
  );
}
