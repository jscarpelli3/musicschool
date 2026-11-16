"use client";

import { useActionState, useState } from "react";
import { FocusedModal } from "@/components/ui/focused-modal";
import { updateFamilyRecord, type FamilyRecordState } from "./actions";

const initialState: FamilyRecordState = { ok: false, message: "" };
export function FamilyRecordEditor({ schoolId, billingAccountId, accountName, firstName, lastName }: { schoolId: string; billingAccountId: string; accountName: string; firstName: string; lastName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (previous: FamilyRecordState, data: FormData) => {
    const result = await updateFamilyRecord(schoolId, billingAccountId, previous, data);
    if (result.ok) setOpen(false);
    return result;
  }, initialState);
  const field = "mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand";
  return <FocusedModal triggerLabel="Edit payer and account name" eyebrow="Family account" title="Edit family details." description="Use whatever names the school normally uses. A payer needs at least one name field." open={open} onOpenChange={setOpen}>
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <label className="sm:col-span-2"><span className="text-xs text-muted">Family account name</span><input name="accountName" defaultValue={accountName} required maxLength={120} className={field} /></label>
      <label><span className="text-xs text-muted">Payer first name</span><input name="firstName" defaultValue={firstName} maxLength={80} className={field} /></label>
      <label><span className="text-xs text-muted">Payer last name</span><input name="lastName" defaultValue={lastName} maxLength={80} className={field} /></label>
      <button disabled={pending} className="border border-brand px-5 py-3 text-sm text-brand hover:bg-brand hover:text-canvas disabled:opacity-50 sm:col-span-2">{pending ? "Saving…" : "Save family details"}</button>
      {state.message ? <p role="status" className={`text-sm sm:col-span-2 ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}
    </form>
  </FocusedModal>;
}
