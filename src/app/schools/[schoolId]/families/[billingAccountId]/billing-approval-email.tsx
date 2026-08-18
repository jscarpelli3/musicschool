"use client";

import { useActionState } from "react";
import { retryBillingApprovalEmail, sendBillingApprovalEmail, type BillingApprovalEmailState } from "./actions";

const initialState: BillingApprovalEmailState = { ok: false, message: "" };

export function BillingApprovalEmail({ schoolId, billingAccountId, billingPeriodId, latestStatus, approvalStatus, approvedAt }: {
  schoolId: string; billingAccountId: string; billingPeriodId: string; latestStatus?: string; approvalStatus?: string; approvedAt?: string | null;
}) {
  const deliveryFailed = approvalStatus === "pending" && latestStatus === "failed";
  const selectedAction = deliveryFailed ? retryBillingApprovalEmail : sendBillingApprovalEmail;
  const [state, action, pending] = useActionState(selectedAction.bind(null, schoolId, billingAccountId, billingPeriodId), initialState);
  return (
    <form action={action} className="mt-5 border border-line bg-panel/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[0.14em] text-brand">Payer approval</p><p className="mt-2 text-sm">{approvalStatus === "approved" ? "Approved · ready to collect" : approvalStatus === "pending" ? "Waiting for payer" : "Send the itemized amount by email"}</p><p className="mt-1 text-xs text-muted">{approvalStatus === "approved" && approvedAt ? `Approved ${new Date(approvedAt).toLocaleString()}` : latestStatus ? <>Email delivery: <span className="uppercase text-brand">{latestStatus}</span></> : "No approval request has been sent."}</p></div>
        {approvalStatus !== "approved" ? <button type="submit" disabled={pending} className="border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:cursor-wait disabled:opacity-50">{pending ? "Sending…" : deliveryFailed ? "Retry approval email" : approvalStatus === "pending" ? "Replace approval link" : "Email approval request"}</button> : <span className="border-l-2 border-brand pl-4 text-sm text-brand">Collection has not started</span>}
      </div>
      {approvalStatus === "pending" ? <p className="mt-4 max-w-xl text-xs leading-5 text-muted">{deliveryFailed ? "Retrying keeps this exact request and amount, rotates the undelivered secure link, and creates a new delivery attempt." : "Replacing the link cancels the current pending request so only the newest exact amount can be approved."}</p> : null}
      {state.message ? <p role="status" className={`mt-4 text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}
    </form>
  );
}
