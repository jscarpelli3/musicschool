"use client";

import { useActionState, useState } from "react";
import { FocusedModal } from "@/components/ui/focused-modal";
import { updateBillingContactEmail, type BillingContactEmailState } from "./actions";

const initialState: BillingContactEmailState = { ok: false, message: "" };

export function BillingContactEmail({ schoolId, billingAccountId, email, hasPendingApproval }: { schoolId: string; billingAccountId: string; email: string; hasPendingApproval: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (previous: BillingContactEmailState, formData: FormData) => {
    const result = await updateBillingContactEmail(schoolId, billingAccountId, previous, formData);
    if (result.ok) {
      setOpen(false);
      window.dispatchEvent(new CustomEvent("common-time:toast", { detail: { title: "Payer email updated", message: result.message } }));
    }
    return result;
  }, initialState);
  const [nextEmail, setNextEmail] = useState(email);
  const [confirmedPendingChange, setConfirmedPendingChange] = useState(false);
  const changesAddress = nextEmail.trim().toLowerCase() !== email.trim().toLowerCase();
  return <div className="mt-6 border-t border-line pt-5">
    <FocusedModal triggerLabel="Edit payer email" eyebrow="Billing contact" title="Change payer email." description="This address controls billing notices and family portal access." open={open} onOpenChange={setOpen}>
    <form action={action} className="flex flex-col gap-4">
      <label className="min-w-0 flex-1">
        <span className="text-xs text-muted">Payer email</span>
        <input name="email" type="email" required value={nextEmail} onChange={(event) => setNextEmail(event.target.value)} autoComplete="email" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" />
      </label>
      {hasPendingApproval && changesAddress ? <label className="flex gap-3 border border-danger/40 bg-danger/5 p-4 text-xs leading-5 text-ink"><input type="checkbox" checked={confirmedPendingChange} onChange={(event) => setConfirmedPendingChange(event.target.checked)} className="mt-1 size-4 accent-current" /><span><strong className="block text-danger">An approval request is already open.</strong>Save the new email and cancel its old approval link. You’ll then send a replacement to {nextEmail.trim()}.</span></label> : null}
      <button disabled={pending || (hasPendingApproval && changesAddress && !confirmedPendingChange)} className="border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Saving…" : hasPendingApproval && changesAddress ? "Update email and cancel old link" : "Save email"}</button>
      {state.message ? <p role="status" className={`text-sm sm:basis-full ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}
    </form>
    </FocusedModal>
  </div>;
}
