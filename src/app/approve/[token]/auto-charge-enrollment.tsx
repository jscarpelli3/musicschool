"use client";

import { useState } from "react";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { enrollAutoChargeMandate } from "./actions";

export function AutoChargeEnrollment({ token, schoolName, accountName, methodLabel, lastFour, amountCents, currency, eligible, activeMandate, initialCapCents, initialNoticeDays }: {
  token: string; schoolName: string; accountName: string; methodLabel: string; lastFour: string | null;
  amountCents: number; currency: string; eligible: boolean; activeMandate: boolean; initialCapCents: number | null; initialNoticeDays: number | null;
}) {
  const [cap, setCap] = useState(((initialCapCents ?? amountCents) / 100).toFixed(2));
  const [noCap, setNoCap] = useState(activeMandate && initialCapCents === null);
  const [noticeDays, setNoticeDays] = useState(initialNoticeDays ?? 3);
  if (activeMandate) return <div className="mt-10 border border-brand p-5 sm:p-6"><p className="text-xs uppercase tracking-[0.14em] text-brand">Automatic payment active</p><p className="mt-3 text-sm leading-6 text-muted">Future itemized monthly statements may be charged to {methodLabel}{lastFour ? ` ending in ${lastFour}` : ""} after {noticeDays} days’ notice{initialCapCents === null ? ", with no monthly maximum" : `, up to ${new Intl.NumberFormat("en-US", { style: "currency", currency }).format(initialCapCents / 100)} per month`}.</p></div>;
  if (!eligible) return <div className="mt-10 border-t border-line pt-8"><p className="text-xs uppercase tracking-[0.14em] text-muted">Automatic payment unavailable</p><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">The school must first send you Stripe’s secure card-setup link. Saving a payment method does not automatically enroll you.</p></div>;

  const terms = `I authorize ${schoolName} to automatically charge ${methodLabel}${lastFour ? ` ending in ${lastFour}` : ""} for itemized monthly school charges on ${accountName}. I will receive the itemized statement at least ${noticeDays} day(s) before collection. ${noCap ? "I have not set a monthly maximum." : `The total automatic charge may not exceed ${cap || "0.00"} ${currency.toUpperCase()} per month.`} I can revoke this authorization for future charges.`;
  return (
    <section className="mt-10 border-t border-line pt-8" aria-labelledby="automatic-payment">
      <p className="text-xs uppercase tracking-[0.14em] text-brand">Optional for future months</p>
      <h2 id="automatic-payment" className="mt-3 font-display text-3xl">Skip monthly approvals</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">You can keep reviewing and approving each month, or authorize automatic payment after receiving the itemized statement.</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label><span className="block text-xs text-muted">Monthly maximum</span><span className={`mt-2 flex border-b border-line focus-within:border-brand ${noCap ? "opacity-40" : ""}`}><span className="py-2 text-muted">$</span><input value={cap} onChange={(event) => setCap(event.target.value)} disabled={noCap} inputMode="decimal" className="min-w-0 flex-1 bg-transparent py-2 pl-1 outline-none" /></span></label>
        <label><span className="block text-xs text-muted">Statement notice before charge</span><select value={noticeDays} onChange={(event) => setNoticeDays(Number(event.target.value))} className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand"><option value={1}>1 day</option><option value={3}>3 days</option><option value={5}>5 days</option><option value={7}>7 days</option><option value={14}>14 days</option></select></label>
        <label className="flex items-start gap-3 text-sm text-muted sm:col-span-2"><input type="checkbox" checked={noCap} onChange={(event) => setNoCap(event.target.checked)} className="mt-1 accent-[var(--color-brand)]" /><span>Do not set a monthly maximum</span></label>
      </div>
      <div className="mt-6 border-l border-line pl-5"><p className="text-xs leading-6 text-muted">{terms}</p></div>
      <div className="mt-6"><HoldToConfirm action={() => enrollAutoChargeMandate(token, cap, noCap, noticeDays)} idleLabel="Hold to authorize automatic payment" holdingLabel="Keep holding to authorize…" /></div>
    </section>
  );
}
