"use client";

import { useActionState, useState } from "react";
import { FocusedModal } from "@/components/ui/focused-modal";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { BillingAdjustmentForm } from "./billing-adjustments";
import { loadPreparedInvoice, lockFamilyBillingPeriod, prepareFamilyBillingDraft, type BillingDraftState, type PreparedInvoice } from "./actions";

const initialState: BillingDraftState = { ok: false, message: "", periodId: null, invoice: null };

export function BillingDraftForm({ schoolId, billingAccountId, defaultMonth, initialOpen = false }: {
  schoolId: string;
  billingAccountId: string;
  defaultMonth: string;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [invoice, setInvoice] = useState<PreparedInvoice | null>(null);
  const [message, setMessage] = useState("");
  const [state, action, pending] = useActionState(async (previous: BillingDraftState, formData: FormData) => {
    const result = await prepareFamilyBillingDraft(schoolId, billingAccountId, previous, formData);
    if (result.invoice) {
      setInvoice(result.invoice);
      setMessage(result.message);
    }
    return result;
  }, initialState);

  async function refreshInvoice() {
    if (!invoice) return;
    const refreshed = await loadPreparedInvoice(schoolId, billingAccountId, invoice.id);
    if (refreshed) setInvoice(refreshed);
  }

  return <FocusedModal open={open} onOpenChange={setOpen} triggerLabel="Prepare invoice" eyebrow="Invoice workspace" title={invoice ? "Review the prepared invoice." : "Choose what you want to bill."} description={invoice ? "Adjust and lock this exact invoice here, or prepare another without moving the page underneath you." : "Start with the unpaid eligible lessons in a service month. You can leave individual lessons for a later invoice before locking."} triggerClassName="rounded-control bg-brand px-5 py-3 text-sm text-canvas transition hover:-translate-y-px hover:bg-brand-hover">
    {invoice ? <div>
      <div className="flex items-start justify-between gap-5"><div><p className="font-display text-2xl">{invoice.familyName}</p><p className="mt-1 text-sm text-muted">{invoice.label} · <span className="capitalize">{invoice.status.replaceAll("_", " ")}</span></p></div><p className="text-xl">{money(invoice.amountDueCents, invoice.currency)}</p></div>
      <div className="mt-5 divide-y divide-line border-y border-line">{invoice.lines.map((line) => <div key={line.id} className="grid grid-cols-[1fr_auto] gap-4 py-3 text-sm"><div><p>{line.description}</p>{line.serviceDate ? <p className="mt-1 text-xs text-muted">{line.serviceDate}</p> : null}</div><p>{money(line.amountCents, invoice.currency)}</p></div>)}</div>
      {message ? <p role="status" className="mt-4 border-l-2 border-brand pl-3 text-sm">{message}</p> : null}
      {invoice.status === "draft" || invoice.status === "review" ? <>
        <BillingAdjustmentForm schoolId={schoolId} billingAccountId={billingAccountId} billingPeriodId={invoice.id} outstandingLessons={invoice.outstandingLessons} embedded onChanged={() => { void refreshInvoice(); }} />
        <div className="mt-5"><HoldToConfirm action={() => lockFamilyBillingPeriod(schoolId, billingAccountId, invoice.id)} idleLabel="Hold to lock this exact amount" holdingLabel="Keep holding to freeze the invoice…" successLabel="Invoice locked" onSuccess={() => { setInvoice((current) => current ? { ...current, status: "locked" } : current); setMessage("Invoice locked. It is ready for its separate payer-approval step."); }} /></div>
      </> : <p className="mt-5 rounded-control bg-brand/10 p-4 text-sm text-brand">This invoice is locked. It is ready for payer approval.</p>}
      <div className="mt-5 flex flex-wrap justify-between gap-3"><button type="button" onClick={() => { setInvoice(null); setMessage(""); }} className="text-sm text-brand">Prepare another invoice</button><button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-ink">Done for now</button></div>
    </div> : <form action={action} className="grid gap-6">
      <label><span className="block text-xs text-muted">Service month</span><input required type="month" name="month" defaultValue={defaultMonth} onClick={(event) => event.currentTarget.showPicker?.()} className="mt-2 w-full cursor-pointer rounded-control border border-line bg-canvas px-3 py-3 outline-none transition focus:border-brand" /></label>
      <p className="text-xs leading-5 text-muted">Preparing does not send or charge anything. You will review the included lessons and choose what to leave for later.</p>
      {state.message && !state.ok ? <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{state.message}</p> : null}
      <button disabled={pending} className="justify-self-start rounded-control bg-brand px-5 py-3 text-sm text-canvas transition hover:bg-brand-hover disabled:cursor-wait disabled:opacity-50">{pending ? "Preparing…" : "Prepare invoice →"}</button>
    </form>}
  </FocusedModal>;
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
