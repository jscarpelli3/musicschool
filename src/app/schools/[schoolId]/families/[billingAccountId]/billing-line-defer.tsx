"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FocusedModal } from "@/components/ui/focused-modal";
import { removeLineFromInvoice, type BillingLineDeferState } from "./actions";

const initialState: BillingLineDeferState = { ok: false, message: "" };

export function BillingLineDefer({ schoolId, billingAccountId, billingPeriodId, lineItemId, description }: {
  schoolId: string;
  billingAccountId: string;
  billingPeriodId: string;
  lineItemId: string;
  description: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(removeLineFromInvoice.bind(null, schoolId, billingAccountId, billingPeriodId, lineItemId), initialState);
  useEffect(() => {
    if (!state.ok) return;
    const timer = window.setTimeout(() => { setOpen(false); router.refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [router, state]);
  return <FocusedModal open={open} onOpenChange={setOpen} triggerLabel="Remove from this invoice" eyebrow="Leave for later" title="Remove this lesson from this invoice?" description={`${description} will remain unpaid and available for a later invoice. This does not waive the charge or create a credit.`} variant="secondary" triggerClassName="mt-2 text-xs text-muted underline decoration-line underline-offset-4 transition hover:text-brand">
    <form action={action} className="grid gap-5">
      <label><span className="text-xs text-muted">Note (optional)</span><input name="reason" maxLength={500} placeholder="Why is this being billed later?" className="mt-2 w-full border-b border-line bg-transparent py-3 text-sm outline-none focus:border-brand" /></label>
      {state.message && !state.ok ? <p role="alert" className="text-sm text-danger">{state.message}</p> : null}
      <button disabled={pending} className="justify-self-start rounded-control border border-brand px-4 py-2.5 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:cursor-wait disabled:opacity-50">{pending ? "Removing…" : "Remove for now"}</button>
    </form>
  </FocusedModal>;
}
