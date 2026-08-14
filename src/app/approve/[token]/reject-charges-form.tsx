"use client";

import { useActionState } from "react";
import { rejectBillingRequest, type RejectBillingState } from "./actions";

const initialState: RejectBillingState = { ok: false, message: "" };

export function RejectChargesForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(rejectBillingRequest.bind(null, token), initialState);
  return <details className="mt-8 border-t border-line pt-6"><summary className="cursor-pointer text-sm text-muted hover:text-ink">Something looks wrong with these charges</summary><form action={action} className="mt-5 grid gap-5"><label><span className="block text-xs text-muted">What needs review?</span><select name="reason" required defaultValue="" className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-brand"><option value="" disabled>Select a reason</option><option value="lesson_did_not_happen">A lesson did not happen</option><option value="wrong_lesson_or_date">A lesson or date is wrong</option><option value="wrong_amount">An amount is wrong</option><option value="missing_credit">A credit or discount is missing</option><option value="duplicate_charge">A charge appears twice</option><option value="other">Other</option></select></label><label><span className="block text-xs text-muted">Note to the school · optional unless Other</span><textarea name="note" maxLength={1000} rows={4} placeholder="For example: We did not have the August 4 lesson." className="mt-2 w-full resize-y border border-line bg-transparent p-3 outline-none focus:border-brand" /></label><div className="flex flex-wrap items-center justify-between gap-4"><p className="max-w-lg text-xs leading-5 text-muted">This does not edit the statement. It stops this proposal and returns it to the school for review.</p><button disabled={pending} className="border border-line px-5 py-3 text-sm transition hover:border-danger hover:text-danger disabled:opacity-50">{pending ? "Sending…" : "Send back for review"}</button></div>{state.message ? <p role="status" className={`text-sm ${state.ok ? "text-muted" : "text-danger"}`}>{state.message}</p> : null}</form></details>;
}
