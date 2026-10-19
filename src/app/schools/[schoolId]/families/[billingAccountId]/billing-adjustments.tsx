"use client";

import { useActionState, useRef, useState } from "react";
import { FocusedModal } from "@/components/ui/focused-modal";
import { AppSelect } from "@/components/ui/app-select";
import { addBillingAdjustment, addOutstandingLessonToInvoice, removeBillingAdjustment, type BillingAdjustmentState, type BillingLessonAddState } from "./actions";

const initialState: BillingAdjustmentState = { ok: false, message: "" };
const initialLessonState: BillingLessonAddState = { ok: false, message: "" };
export type OutstandingLessonChoice = { lessonEventId: string; studentName: string; offeringName: string; serviceDate: string; startsAt: string; amountCents: number; currency: string };

export function BillingAdjustmentForm({ schoolId, billingAccountId, billingPeriodId, outstandingLessons, embedded = false, onChanged }: {
  schoolId: string; billingAccountId: string; billingPeriodId: string; outstandingLessons: OutstandingLessonChoice[]; embedded?: boolean; onChanged?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"charge" | "credit" | "lesson">("charge");
  const [state, action, pending] = useActionState(async (previous: BillingAdjustmentState, formData: FormData) => {
    const result = await addBillingAdjustment(schoolId, billingAccountId, billingPeriodId, previous, formData);
    if (result.ok) {
      formRef.current?.reset();
      if (!embedded) setOpen(false);
      onChanged?.();
      window.dispatchEvent(new CustomEvent("common-time:toast", { detail: { title: "Adjustment added", message: result.message } }));
    }
    return result;
  }, initialState);
  const [lessonState, lessonAction, lessonPending] = useActionState(async (previous: BillingLessonAddState, formData: FormData) => {
    const result = await addOutstandingLessonToInvoice(schoolId, billingAccountId, billingPeriodId, previous, formData);
    if (result.ok) {
      if (!embedded) setOpen(false);
      onChanged?.();
      window.dispatchEvent(new CustomEvent("common-time:toast", { detail: { title: "Lesson added", message: result.message } }));
    }
    return result;
  }, initialLessonState);
  const content = <>
      <div className="mb-6 grid grid-cols-3 rounded-control bg-canvas/70 p-1" role="group" aria-label="Adjustment type">
        {([['charge','Add charge'],['credit','Add credit'],['lesson','Add lesson']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-control px-3 py-2 text-sm ${mode === value ? "bg-surface-raised text-ink shadow-sm" : "text-muted"}`}>{label}</button>)}
      </div>
      {mode === "lesson" ? <form action={lessonAction} className="grid gap-5">
        {outstandingLessons.length ? <label><span className="block text-xs text-muted">Outstanding lesson</span><AppSelect required name="lesson_event_id" defaultValue="" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand"><option value="" disabled>Select a lesson</option>{outstandingLessons.map((lesson) => <option key={lesson.lessonEventId} value={lesson.lessonEventId}>{lesson.studentName} · {lesson.offeringName} · {lesson.serviceDate} · {new Intl.NumberFormat("en-US", { style: "currency", currency: lesson.currency }).format(lesson.amountCents / 100)}</option>)}</AppSelect></label> : <p className="rounded-control bg-canvas p-4 text-sm text-muted">No eligible unpaid lessons are available. Lessons already paid, already on another invoice, or not ready for billing are excluded.</p>}
        <div className="flex flex-wrap items-center justify-between gap-4"><p className="max-w-lg text-xs leading-5 text-muted">The lesson uses its saved price, service date, and accounting terms. Its amount cannot be typed manually.</p><button disabled={lessonPending || !outstandingLessons.length} className="border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:opacity-50">{lessonPending ? "Adding…" : "Add lesson"}</button></div>
        {lessonState.message ? <p role="status" className={`text-sm ${lessonState.ok ? "text-muted" : "text-danger"}`}>{lessonState.message}</p> : null}
      </form> : <form ref={formRef} action={action} className="grid gap-5 sm:grid-cols-2">
        <input type="hidden" name="kind" value={mode} />
        <label><span className="block text-xs text-muted">Amount</span><span className="mt-2 flex border-b border-line focus-within:border-brand"><span className="py-2 text-muted">$</span><input name="amount" required inputMode="decimal" placeholder="0.00" className="min-w-0 flex-1 bg-transparent py-2 pl-1 outline-none" /></span></label>
        <label><span className="block text-xs text-muted">Category</span><AppSelect name="category" required defaultValue="" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand"><option value="" disabled>Select a category</option><option>Additional lesson</option><option>Materials</option><option>Registration or event</option><option>Courtesy adjustment</option><option>Billing correction</option><option>Other</option></AppSelect></label>
        <label><span className="block text-xs text-muted">Explanation · required</span><input name="description" required maxLength={300} placeholder="What changed and why?" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand" /></label>
        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-4"><p className="max-w-lg text-xs leading-5 text-muted">Adjustments become ordinary ledger lines and remain visible to the payer. Locking freezes them with the lesson charges.</p><button disabled={pending} className="border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:opacity-50">{pending ? "Saving…" : "Add adjustment"}</button></div>
        {state.message ? <p role="status" className={`sm:col-span-2 text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}
      </form>}
    </>;
  if (embedded) return <div className="mt-5 border-t border-line pt-5">{content}</div>;
  return <div className="mt-5 border-t border-line pt-5"><FocusedModal triggerLabel="Adjust this invoice" eyebrow="Invoice composition" title="Adjust this invoice." description="Add a credit, a manual charge, or an eligible unpaid lesson before locking." open={open} onOpenChange={setOpen}>{content}</FocusedModal></div>;
}

export function BillingAdjustmentRemove({ schoolId, billingAccountId, billingPeriodId, adjustmentId }: {
  schoolId: string; billingAccountId: string; billingPeriodId: string; adjustmentId: string;
}) {
  return <form action={async () => { await removeBillingAdjustment(schoolId, billingAccountId, billingPeriodId, adjustmentId); }}><button className="text-action text-xs text-muted hover:bg-danger/10 hover:text-danger">Remove</button></form>;
}
