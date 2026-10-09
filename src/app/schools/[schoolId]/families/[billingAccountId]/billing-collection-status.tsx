"use client";

import { MdArrowDownward, MdCreditCard } from "react-icons/md";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { collectFamilyInvoice } from "./actions";

export function BillingCollectionStatus({ schoolId, billingAccountId, billingPeriodId, amount, hasPaymentMethod, readiness, attemptStatus }: {
  schoolId: string;
  billingAccountId: string;
  billingPeriodId: string;
  amount: string;
  hasPaymentMethod: boolean;
  readiness: string | null;
  attemptStatus: string | null;
}) {
  const active = attemptStatus !== null && ["created", "submitted", "processing"].includes(attemptStatus);
  const needsAttention = attemptStatus === "requires_action";
  const failed = attemptStatus === "failed";
  const canCollect = hasPaymentMethod && readiness === "ready" && !active && !needsAttention;
  const title = active ? "Payment submitted — awaiting confirmation"
    : needsAttention ? "Payer authentication is required"
      : failed ? "Payment failed — ready to retry"
        : hasPaymentMethod ? "Approved — ready to collect" : "Approved — card setup needed";
  const detail = active
    ? `Stripe is processing ${amount}. This page will show paid only after a verified Stripe event confirms the result. Do not submit another charge.`
    : needsAttention
      ? `The bank would not allow the ${amount} off-session payment without the payer present. No second attempt will be made automatically.`
      : failed
        ? `The prior attempt did not collect ${amount}. Confirm the default payment method is current, then hold to submit one new attempt.`
        : hasPaymentMethod
          ? `The payer approved this exact ${amount} statement. Holding the button submits one off-session charge to the family's default saved payment method.`
          : `The payer approved ${amount}, but this family has no active saved payment method. Common Time cannot collect it until the payer securely adds one.`;
  return (
    <div className="mt-5 rounded-card border border-brand/30 bg-brand/5 p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/10 text-2xl text-brand"><MdCreditCard /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.14em] text-brand">Payment collection</p>
          <h3 className="mt-1 font-display text-2xl">{title}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{detail}</p>
          {canCollect ? <div className="mt-5 max-w-sm"><HoldToConfirm action={() => collectFamilyInvoice(schoolId, billingAccountId, billingPeriodId)} idleLabel={`Hold to charge ${amount}`} holdingLabel="Keep holding to submit one charge…" submittingLabel="Submitting securely…" successLabel="Payment submitted" refreshOnSuccess /></div> : null}
          {!hasPaymentMethod ? <a href="#payment-methods" className="mt-5 inline-flex items-center gap-2 border border-brand px-4 py-2.5 text-sm text-brand transition hover:bg-brand hover:text-canvas">Go to payment-method setup <MdArrowDownward aria-hidden="true" /></a> : null}
        </div>
      </div>
    </div>
  );
}
