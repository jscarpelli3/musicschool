"use client";

import { useRef, useState, useTransition } from "react";
import { FocusedModal } from "@/components/ui/focused-modal";
import type { AddFamilyState } from "@/app/schools/[schoolId]/families/actions";

const initialState: AddFamilyState = { ok: false, message: "" };
const field = "mt-2 w-full rounded-control border border-line bg-surface px-4 py-3 outline-none focus:border-brand";

export function AddFamilyDialog({ action, triggerLabel }: { action: (state: AddFamilyState, formData: FormData) => Promise<AddFamilyState>; triggerLabel: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const operationId = useRef<string | null>(null);
  const submit = (formData: FormData) => startTransition(async () => {
    operationId.current ??= crypto.randomUUID();
    formData.set("operation_id", operationId.current);
    const next = await action(initialState, formData);
    setState(next);
    if (!next.ok) return;
    setOpen(false);
    operationId.current = null;
    window.dispatchEvent(new CustomEvent("common-time:toast", { detail: { title: "Family added", message: "The student, payer, and family account are ready." } }));
  });
  return <FocusedModal triggerLabel={triggerLabel} title="Add a student and payer." description="This creates the student record and connects it to the person responsible for billing." open={open} onOpenChange={setOpen}>
    <form action={submit} className="grid gap-5 sm:grid-cols-2">
      <label><span className="text-xs text-muted">Student first name</span><input required name="student_first" autoFocus className={field} /></label>
      <label><span className="text-xs text-muted">Student last name</span><input required name="student_last" className={field} /></label>
      <label><span className="text-xs text-muted">Payer first name</span><input required name="payer_first" autoComplete="given-name" className={field} /></label>
      <label><span className="text-xs text-muted">Payer last name</span><input required name="payer_last" autoComplete="family-name" className={field} /></label>
      <label className="sm:col-span-2"><span className="text-xs text-muted">Payer email</span><input required name="payer_email" type="email" autoComplete="email" className={field} /><span className="mt-2 block text-xs leading-5 text-muted">Billing summaries, approvals, and portal access go to this address.</span></label>
      <label><span className="text-xs text-muted">Relationship to student</span><select name="relationship" className={field}><option value="parent">Parent</option><option value="guardian">Guardian</option><option value="self">Self</option><option value="other">Other</option></select></label>
      <div className="flex items-end"><button disabled={pending} className="w-full rounded-control bg-ink px-5 py-3 text-sm text-canvas disabled:opacity-50">{pending ? "Adding…" : "Add student and payer"}</button></div>
      {state.message && !state.ok ? <p role="alert" className="text-sm text-danger sm:col-span-2">{state.message}</p> : null}
    </form>
  </FocusedModal>;
}
