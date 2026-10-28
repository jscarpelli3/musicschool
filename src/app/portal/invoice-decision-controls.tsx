"use client";

import { useActionState } from "react";
import { MdErrorOutline, MdExpandMore } from "react-icons/md";
import { AppSelect } from "@/components/ui/app-select";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { approvePortalInvoice, rejectPortalInvoice, type PortalInvoiceReviewState } from "./invoice-actions";

const initialState: PortalInvoiceReviewState = { ok: false, message: "" };

export function InvoiceDecisionControls({ schoolId, billingPeriodId, amount }: { schoolId: string; billingPeriodId: string; amount: string }) {
  const [reviewState, reviewAction, reviewPending] = useActionState(rejectPortalInvoice.bind(null, schoolId, billingPeriodId), initialState);
  return <div className="mt-5 grid gap-4 border-t border-line pt-5">
    <div className="rounded-control border border-brand/30 bg-brand/10 p-4"><p className="text-xs font-medium uppercase tracking-[0.12em] text-brand">Waiting for your response</p><p className="mt-2 text-sm leading-6">Approve this exact {amount} invoice, or tell the school what needs changing. Approval does not charge your card.</p><div className="mt-4"><HoldToConfirm prominent centered action={() => approvePortalInvoice(schoolId, billingPeriodId)} idleLabel={`Hold to approve ${amount}`} holdingLabel="Keep holding to record your approval…" submittingLabel="Recording approval…" successLabel="Invoice approved" refreshOnSuccess /></div></div>
    <details className="group rounded-control border border-danger/30 bg-danger/5 p-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden"><span className="flex items-center gap-2 text-sm text-danger"><MdErrorOutline className="text-lg" />Request a change</span><MdExpandMore className="text-xl text-muted transition group-open:rotate-180" /></summary><form action={reviewAction} className="mt-4 grid gap-4 border-t border-danger/20 pt-4"><label><span className="text-xs text-muted">What needs review?</span><AppSelect name="reason" required defaultValue="" className="mt-2 w-full border-b border-line bg-transparent py-2"><option value="" disabled>Select a reason</option><option value="lesson_did_not_happen">A lesson did not happen</option><option value="wrong_lesson_or_date">A lesson or date is wrong</option><option value="wrong_amount">An amount is wrong</option><option value="missing_credit">A credit or discount is missing</option><option value="duplicate_charge">A charge appears twice</option><option value="other">Other</option></AppSelect></label><label><span className="text-xs text-muted">Note to the school · optional unless Other</span><textarea name="note" maxLength={1000} rows={3} className="mt-2 w-full resize-y rounded-control border border-line bg-canvas p-3 outline-none focus:border-brand" /></label><button disabled={reviewPending} className="justify-self-start rounded-control border border-danger/60 px-4 py-2.5 text-sm text-danger transition hover:bg-danger hover:text-canvas disabled:opacity-50">{reviewPending ? "Sending…" : "Send back for review"}</button>{reviewState.message ? <p role="status" className={`text-sm ${reviewState.ok ? "text-brand" : "text-danger"}`}>{reviewState.message}</p> : null}</form></details>
  </div>;
}
