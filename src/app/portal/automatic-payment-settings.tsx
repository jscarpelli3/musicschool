"use client";

import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { revokePortalAutoChargeMandate } from "./collection-actions";

type AutomaticPaymentSettingsProps = {
  schoolId: string;
  schoolName: string;
  billingAccountId: string;
  billingAccountName: string;
  currency: string;
  paymentMethodLabel: string | null;
  paymentMethodLastFour: string | null;
  monthlyCapCents: number | null;
  advanceNoticeDays: number;
  acceptedAt: string;
};

export function AutomaticPaymentSettings(props: AutomaticPaymentSettingsProps) {
  const method = props.paymentMethodLabel ?? "saved payment method";
  const cap = props.monthlyCapCents === null
    ? "No monthly maximum"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: props.currency }).format(props.monthlyCapCents / 100);

  return <section className="border border-brand p-5 sm:p-6">
    <p className="text-xs uppercase tracking-[0.14em] text-brand">Automatic payment active</p>
    <h3 className="mt-3 font-display text-2xl">{props.billingAccountName}</h3>
    <p className="mt-3 text-sm leading-6 text-muted">
      {props.schoolName} may charge {method}{props.paymentMethodLastFour ? ` ending in ${props.paymentMethodLastFour}` : ""} for itemized monthly statements after {props.advanceNoticeDays} day(s) notice.
    </p>
    <dl className="mt-5 grid gap-4 border-y border-line py-4 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-muted">Monthly limit</dt><dd className="mt-1">{cap}</dd></div>
      <div><dt className="text-xs text-muted">Accepted</dt><dd className="mt-1">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(props.acceptedAt))}</dd></div>
    </dl>
    <p className="mt-5 text-xs leading-5 text-muted">Stopping automatic payment takes effect before any new charge attempt. It does not remove the saved card or change statements already paid.</p>
    <div className="mt-5">
      <HoldToConfirm
        action={() => revokePortalAutoChargeMandate(props.schoolId, props.billingAccountId)}
        idleLabel="Hold to stop automatic payment"
        holdingLabel="Keep holding to stop…"
        submittingLabel="Stopping automatic payment…"
        successLabel="Automatic payment stopped"
        refreshOnSuccess
      />
    </div>
  </section>;
}
