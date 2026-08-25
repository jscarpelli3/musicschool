"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updateBillingContactPhone, type BillingContactPhoneState } from "./actions";
import { FocusedModal } from "@/components/ui/focused-modal";

const initialState: BillingContactPhoneState = { ok: false, message: "" };

export function BillingContactPhone({ schoolId, schoolName, billingAccountId, phone, consentState }: {
  schoolId: string;
  schoolName: string;
  billingAccountId: string;
  phone: string;
  consentState: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (previous: BillingContactPhoneState, formData: FormData) => {
    const result = await updateBillingContactPhone(schoolId, billingAccountId, previous, formData);
    if (result.ok) {
      setOpen(false);
      window.dispatchEvent(new CustomEvent("common-time:toast", { detail: { title: "Mobile number updated", message: result.message } }));
    }
    return result;
  }, initialState);
  const consentLabel = consentState === "opted_in" ? "Texting enrolled"
    : consentState === "opted_out" ? "Texting stopped" : "Not enrolled for texts";

  return (
    <div className="mt-6 max-w-xl border-t border-line pt-5">
      <FocusedModal triggerLabel="Edit mobile number" eyebrow="Billing contact" title="Change mobile number." description="Update the number used for school text notices." open={open} onOpenChange={setOpen}>
      <form action={action} className="flex flex-col gap-4">
        <label className="min-w-0 flex-1">
          <span className="text-xs text-muted">Payer mobile number</span>
          <input name="phone" type="tel" required defaultValue={phone} autoComplete="tel" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" />
        </label>
        <button disabled={pending} className="border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:opacity-50">
          {pending ? "Saving…" : "Save number"}
        </button>
      </form>
      </FocusedModal>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className={consentState === "opted_in" ? "text-brand" : consentState === "opted_out" ? "text-danger" : "text-muted"}>{consentLabel}</span>
        {consentState === "not_enrolled" ? <Link href={`/sms-consent?school=${encodeURIComponent(schoolName)}`} className="line-action pb-1 text-brand">Open payer consent form</Link> : null}
        {consentState === "opted_out" ? <span className="text-muted">The payer must text START or UNSTOP.</span> : null}
      </div>
      {state.message ? <p role="status" className={`mt-3 text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}
    </div>
  );
}
