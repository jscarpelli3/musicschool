"use client";

import { useActionState, useEffect, useState } from "react";
import type { CancellationPolicyState } from "@/app/schools/[schoolId]/policies/actions";

type InitialPolicy = {
  name: string;
  cancelCutoffHours: number;
  rescheduleCutoffHours: number;
  timelyDisposition: string;
  lateLessonResolution: string;
  lateRescheduleFeeCents: number;
  replacementWindowDays: number;
  mustKeepAssignedTeacher: boolean;
  timelyGuidance: string;
  lateGuidance: string;
};

const field = "mt-2 w-full border-b border-line bg-transparent py-3 outline-none transition focus:border-brand";
const initialState: CancellationPolicyState = { ok: false, message: "" };

export function CancellationPolicyForm({ initial, action }: {
  initial: InitialPolicy;
  action: (previous: CancellationPolicyState, formData: FormData) => Promise<CancellationPolicyState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [lateResolution, setLateResolution] = useState(initial.lateLessonResolution);

  useEffect(() => {
    if (!state.ok) return;
    window.dispatchEvent(new CustomEvent("common-time:toast", { detail: { title: "Policy published", message: state.message } }));
  }, [state]);

  return <form action={formAction} className="space-y-10">
    <section>
      <p className="text-xs uppercase tracking-[0.14em] text-brand">Published default</p>
      <label className="mt-4 block"><span className="text-sm font-medium">Policy name</span><input name="name" required maxLength={120} defaultValue={initial.name} className={field} /></label>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <label><span className="text-sm font-medium">Cancellation notice</span><span className="mt-1 block text-xs text-muted">Hours before the lesson</span><input name="cancel_cutoff_hours" type="number" min="0" max="8760" required defaultValue={initial.cancelCutoffHours} className={field} /></label>
        <label><span className="text-sm font-medium">Reschedule notice</span><span className="mt-1 block text-xs text-muted">Hours before the lesson</span><input name="reschedule_cutoff_hours" type="number" min="0" max="8760" required defaultValue={initial.rescheduleCutoffHours} className={field} /></label>
      </div>
    </section>

    <section className="border-l-2 border-brand pl-5">
      <h3 className="font-display text-2xl">Within the notice window</h3>
      <label className="mt-5 block"><span className="text-sm font-medium">Normal accounting result</span><select name="timely_disposition" defaultValue={initial.timelyDisposition} className={field}><option value="waive">Do not count or charge for the canceled lesson</option><option value="credit">Issue a lesson credit</option><option value="manual_review">Always ask the owner to decide</option><option value="charge">Count the lesson as serviced</option></select></label>
      <label className="mt-5 block"><span className="text-sm font-medium">Message shown to families</span><textarea name="timely_guidance" required maxLength={1000} rows={3} defaultValue={initial.timelyGuidance} className="mt-2 w-full border border-line bg-transparent p-3 outline-none focus:border-brand" /></label>
    </section>

    <section className="border-l-2 border-danger pl-5">
      <h3 className="font-display text-2xl">Outside the notice window</h3>
      <label className="mt-5 block"><span className="text-sm font-medium">What normally happens to the lesson?</span><select name="late_lesson_resolution" value={lateResolution} onChange={(event) => setLateResolution(event.target.value)} className={field}><option value="count_as_serviced">Count it as serviced; no replacement lesson</option><option value="retain_for_reschedule">Keep the lesson and require it to be rescheduled</option><option value="waive">Cancel it without counting or charging it</option><option value="manual_review">Always ask the owner to decide</option></select></label>
      {lateResolution === "retain_for_reschedule" ? <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <label><span className="text-sm font-medium">Late reschedule fee</span><span className="mt-1 block text-xs text-muted">Added to the next editable invoice; enter 0 for none</span><div className="relative"><span className="absolute left-0 top-5 text-muted">$</span><input name="late_reschedule_fee_dollars" type="number" min="0" max="10000" step="1" required defaultValue={initial.lateRescheduleFeeCents / 100} className={`${field} pl-5`} /></div></label>
        <label><span className="text-sm font-medium">Replacement deadline</span><span className="mt-1 block text-xs text-muted">Days to schedule the retained lesson</span><input name="replacement_window_days" type="number" min="0" max="365" required defaultValue={initial.replacementWindowDays} className={field} /></label>
      </div> : <><input type="hidden" name="late_reschedule_fee_dollars" value="0" /><input type="hidden" name="replacement_window_days" value={initial.replacementWindowDays} /></>}
      <label className="mt-5 flex items-start gap-3 text-sm"><input name="must_keep_assigned_teacher" type="checkbox" defaultChecked={initial.mustKeepAssignedTeacher} className="mt-1 accent-brand" /><span><strong className="font-medium">Keep the assigned teacher</strong><span className="mt-1 block text-xs leading-5 text-muted">The replacement normally stays with the same teacher. The owner can still make an individual exception.</span></span></label>
      <label className="mt-5 block"><span className="text-sm font-medium">Message shown to families</span><textarea name="late_guidance" required maxLength={1000} rows={4} defaultValue={initial.lateGuidance} className="mt-2 w-full border border-line bg-transparent p-3 outline-none focus:border-brand" /></label>
    </section>

    <aside className="bg-surface-raised p-5 text-sm leading-6"><p className="font-medium">Policies guide; people decide.</p><p className="mt-1 text-muted">This becomes the normal result shown during requests. An owner or authorized admin can make a documented exception for any individual lesson, fee, credit, or reschedule entitlement.</p></aside>
    <div className="flex flex-wrap items-center gap-5"><button disabled={pending} className="border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:opacity-50">{pending ? "Publishing…" : "Publish new policy version"}</button>{state.message && !state.ok ? <p role="alert" className="text-sm text-danger">{state.message}</p> : null}</div>
  </form>;
}
