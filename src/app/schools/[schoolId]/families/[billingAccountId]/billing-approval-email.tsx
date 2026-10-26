"use client";

import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { retryBillingApprovalEmail, sendBillingApprovalEmail } from "./actions";

const initialState = { ok: false, message: "" };

export function BillingApprovalEmail({ schoolId, billingAccountId, billingPeriodId, latestStatus, latestRecipientEmail, payerEmail, approvalStatus, approvedAt }: {
  schoolId: string; billingAccountId: string; billingPeriodId: string; latestStatus?: string; latestRecipientEmail?: string; payerEmail: string; approvalStatus?: string; approvedAt?: string | null;
}) {
  const deliveryFailed = approvalStatus === "pending" && latestStatus === "failed";
  const recipientChanged = Boolean(latestRecipientEmail) && latestRecipientEmail?.trim().toLowerCase() !== payerEmail.trim().toLowerCase();
  const useRetry = deliveryFailed && !recipientChanged;
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
        {approvalStatus !== "approved" ? <div className="w-full max-w-sm"><HoldToConfirm compact centered action={() => useRetry ? retryBillingApprovalEmail(schoolId, billingAccountId, billingPeriodId, initialState) : sendBillingApprovalEmail(schoolId, billingAccountId, billingPeriodId, initialState)} idleLabel={deliveryFailed ? "Hold to resend approval email" : approvalStatus === "pending" ? "Hold to replace approval link" : "Hold to email approval request"} holdingLabel="Keep holding to send…" submittingLabel="Sending approval email…" successLabel="Approval email sent" refreshOnSuccess /></div> : <span className="border-l-2 border-brand pl-4 text-sm text-brand">Approval received</span>}
      </div>
      {approvalStatus === "pending" ? <p className="mt-4 max-w-xl text-xs leading-5 text-muted">{deliveryFailed ? recipientChanged ? `The payer email changed. Sending will cancel the old link and deliver a replacement to ${payerEmail}.` : `Sending will retry this approval request to ${payerEmail}.` : "Replacing the link cancels the current pending request so only the newest exact amount can be approved."}</p> : null}
    </div>
  );
}
