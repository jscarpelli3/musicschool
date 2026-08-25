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
  const changesAddress = nextEmail.trim().toLowerCase() !== email.trim().toLowerCase();
  return <div className="mt-6 border-t border-line pt-5">
    <FocusedModal triggerLabel="Edit payer email" eyebrow="Billing contact" title="Change payer email." description="This address controls billing notices and family portal access." open={open} onOpenChange={setOpen}>
    <form action={action} onSubmit={(event) => { if (hasPendingApproval && changesAddress && !window.confirm("Changing this email address will invalidate the pending approval link. You will need to send the approval request again to the new address. Continue?")) event.preventDefault(); }} className="flex flex-col gap-4">
      <label className="min-w-0 flex-1">
        <span className="text-xs text-muted">Payer email</span>
        <input name="email" type="email" required value={nextEmail} onChange={(event) => setNextEmail(event.target.value)} autoComplete="email" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" />
      </label>
      <button disabled={pending} className="border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:opacity-50">{pending ? "Saving…" : "Save email"}</button>
      {hasPendingApproval && changesAddress ? <p className="text-xs leading-5 text-danger sm:basis-full">Changing this address invalidates the pending approval link. After saving, send the approval request again to the new address.</p> : null}
      {state.message ? <p role="status" className={`text-sm sm:basis-full ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}
    </form>
    </FocusedModal>
  </div>;
}
