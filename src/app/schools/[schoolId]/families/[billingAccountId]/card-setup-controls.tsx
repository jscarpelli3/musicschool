"use client";

import { useActionState } from "react";
import Link from "next/link";
import { PendingActionStatus } from "@/components/ui/pending-action-status";
import { generateFamilyCardSetupLink, type CardSetupLinkState } from "./actions";

const initialState: CardSetupLinkState = { url: null, error: null, recovery: null };

export function CardSetupControls({ schoolId, billingAccountId, activeMethodCount, disabled }: {
  schoolId: string;
  billingAccountId: string;
  activeMethodCount: number;
  disabled: boolean;
}) {
  const boundAction = generateFamilyCardSetupLink.bind(null, schoolId, billingAccountId);
  const [state, action, pending] = useActionState(boundAction, initialState);
  const hasMethod = activeMethodCount > 0;
  const atLimit = activeMethodCount >= 3;
  return (
    <div className={hasMethod ? "pt-1" : "border-t border-line pt-5"}>
      <div className={hasMethod ? "flex flex-col gap-3 rounded-control bg-surface p-4 sm:flex-row sm:items-center sm:justify-between" : ""}>
        <div><p className="text-sm font-medium text-ink">{hasMethod ? "Add another payment method" : "Payer here with you?"}</p><p className="mt-1 max-w-xl text-xs leading-5 text-muted">{atLimit ? "Three active methods are already saved. Remove one before adding another." : hasMethod ? `Up to three cards can be saved. ${activeMethodCount} of 3 currently active.` : "Prepare a private Stripe form, then hand the device to the payer so they can enter their own card details."}</p></div>
        {!atLimit ? <form action={action} className="shrink-0">
          <button type="submit" disabled={disabled || pending} className={`${hasMethod ? "px-4 py-2" : "mt-4 px-5 py-3"} rounded-control bg-brand text-sm font-medium text-canvas transition hover:-translate-y-px hover:bg-brand-hover disabled:cursor-wait disabled:opacity-50`}>
            {pending ? "Preparing…" : hasMethod ? "Add another card" : "Prepare card setup"}
          </button>
        </form> : null}
      </div>
      <PendingActionStatus pending={pending} label="Preparing the secure Stripe setup link…" />
      {state.error ? <p className="mt-3 border-l border-danger pl-3 text-xs text-danger">{state.error}</p> : null}
      {state.recovery === "payments" ? <Link href={`/schools/${schoolId}/payments`} className="mt-3 inline-block border-b border-brand pb-1 text-sm text-brand hover:text-ink">Open school payment settings →</Link> : null}
      {state.url ? <div className="mt-5 rounded-control border border-brand/40 bg-brand/10 p-4"><p className="text-sm font-medium text-ink">Ready for the payer</p><p className="mt-1 text-xs leading-5 text-muted">Open Stripe, then let the payer complete the private form. No payment is taken.</p><a href={state.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-control border border-brand bg-surface px-5 py-3 text-sm font-medium text-brand transition hover:-translate-y-px hover:bg-brand hover:text-canvas">Open secure Stripe form ↗</a></div> : null}
      {disabled ? <p className="mt-2 text-xs text-danger">The school’s Stripe connection must be enabled first.</p> : null}
    </div>
  );
}
