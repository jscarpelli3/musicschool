"use client";
import { useActionState } from "react";
import { createFirstFamily, type FamilyState } from "./actions";
const initial: FamilyState = { ok: false, message: "" };
const field = "w-full rounded-control border border-line bg-surface px-4 py-3";
export function FamilyForm({ schoolId }: { schoolId: string }) {
  const [state, action, pending] = useActionState(createFirstFamily.bind(null, schoolId), initial);
  return <form action={action} className="mt-6 grid gap-4 sm:grid-cols-2">
    <label><span className="mb-2 block text-sm text-muted">Student first name</span><input required name="student_first" autoComplete="off" className={field} /></label>
    <label><span className="mb-2 block text-sm text-muted">Student last name</span><input required name="student_last" autoComplete="off" className={field} /></label>
    <label><span className="mb-2 block text-sm text-muted">Payer first name</span><input required name="payer_first" autoComplete="given-name" className={field} /></label>
    <label><span className="mb-2 block text-sm text-muted">Payer last name</span><input required name="payer_last" autoComplete="family-name" className={field} /></label>
    <label className="sm:col-span-2"><span className="mb-2 block text-sm text-muted">Payer email</span><input required name="payer_email" type="email" autoComplete="email" className={field} /><span className="mt-2 block text-xs leading-5 text-muted">This is where billing summaries and approval requests will go.</span></label>
    <label><span className="mb-2 block text-sm text-muted">Relationship to student</span><select name="relationship" className={field}><option value="parent">Parent</option><option value="guardian">Guardian</option><option value="other">Other</option></select></label>
    <div className="flex items-end"><button disabled={pending} className="w-full rounded-control bg-ink px-5 py-3 text-sm text-canvas disabled:opacity-50">{pending ? "Adding…" : "Add student and payer"}</button></div>
    {state.message ? <p role="status" className={`sm:col-span-2 text-sm ${state.ok ? "text-brand" : "text-danger"}`}>{state.message}</p> : null}
  </form>;
}
