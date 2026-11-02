"use client";

import { useMemo, useState, useTransition } from "react";
import { MdChevronLeft, MdChevronRight, MdReceiptLong, MdSearch } from "react-icons/md";
import { FocusedModal } from "@/components/ui/focused-modal";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { loadPreparedInvoice, lockFamilyBillingPeriod, prepareFamilyBillingDraft, sendBillingApprovalEmail, type BillingDraftState, type PreparedInvoice } from "@/app/schools/[schoolId]/families/[billingAccountId]/actions";
import { BillingAdjustmentForm } from "@/app/schools/[schoolId]/families/[billingAccountId]/billing-adjustments";
import { BillingLineDefer } from "@/app/schools/[schoolId]/families/[billingAccountId]/billing-line-defer";

export type InvoicePayerChoice = { id: string; name: string; students: string[] };
const initialDraft: BillingDraftState = { ok: false, message: "", periodId: null, invoice: null };

export function PrepareInvoiceLauncher({ schoolId, payers, variant }: { schoolId: string; payers: InvoicePayerChoice[]; variant: "nav" | "dashboard" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [payer, setPayer] = useState<InvoicePayerChoice | null>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [message, setMessage] = useState("");
  const [queue, setQueue] = useState<PreparedInvoice[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const [adjustmentEditing, setAdjustmentEditing] = useState(false);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return payers;
    return payers.filter((choice) => [choice.name, ...choice.students].some((label) => label.toLocaleLowerCase().includes(query)));
  }, [payers, search]);
  const dashboard = variant === "dashboard";
  const invoice = queue[queueIndex] ?? null;

  function prepare(formData: FormData) {
    if (!payer) return;
    setMessage("");
    startTransition(async () => {
      const result = await prepareFamilyBillingDraft(schoolId, payer.id, initialDraft, formData);
      setMessage(result.message);
      if (!result.invoice) return;
      setQueue((current) => {
        const next = [...current.filter((item) => item.id !== result.invoice!.id), result.invoice!];
        setQueueIndex(next.length - 1);
        return next;
      });
    });
  }

  function updateInvoice(id: string, updates: Partial<PreparedInvoice>) {
    setQueue((current) => current.map((item) => item.id === id ? { ...item, ...updates } : item));
  }

  return <FocusedModal open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setSearch(""); setPayer(null); setMessage(""); } }} triggerLabel="Prepare an invoice" eyebrow="Invoice workspace" title={invoice ? "Review prepared invoices." : payer ? `Prepare ${payer.name}’s invoice.` : "Who are you billing?"} description={invoice ? "Review and lock each exact amount before sending its payer approval request." : "Search by payer, family, or student, then choose the service month."} disabled={!payers.length}
    triggerContent={dashboard ? <><MdReceiptLong aria-hidden="true" className="mb-2 text-3xl text-brand" /><span className="font-display text-3xl font-normal tracking-[-0.03em]">Prepare an invoice</span><span className="mt-2 max-w-xs text-xs leading-5 text-muted">Choose a payer, then review their unpaid lessons for a month.</span></> : <><MdReceiptLong aria-hidden="true" className="text-lg" />Prepare invoice</>}
    triggerClassName={dashboard ? "flex h-full min-h-40 w-full flex-col items-center justify-center rounded-card border border-transparent bg-surface-raised/55 px-6 py-7 text-center shadow-[var(--ui-shadow-soft)] transition duration-200 hover:-translate-y-1 hover:scale-[1.025] hover:border-brand/50 hover:bg-surface-raised hover:text-brand hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50" : "inline-flex items-center gap-1.5 text-sm text-brand transition hover:text-brand-hover disabled:cursor-not-allowed disabled:text-muted"}>
    {invoice ? <div>
      <div className="flex items-center justify-between gap-4 border-b border-line pb-4"><button type="button" aria-label="Previous prepared invoice" disabled={queueIndex === 0} onClick={() => { setAdjustmentEditing(false); setQueueIndex((value) => value - 1); }} className="grid size-9 place-items-center rounded-full border border-line disabled:opacity-30"><MdChevronLeft /></button><p className="text-xs text-muted">Prepared invoice {queueIndex + 1} of {queue.length}</p><button type="button" aria-label="Next prepared invoice" disabled={queueIndex === queue.length - 1} onClick={() => { setAdjustmentEditing(false); setQueueIndex((value) => value + 1); }} className="grid size-9 place-items-center rounded-full border border-line disabled:opacity-30"><MdChevronRight /></button></div>
      <div className="py-5"><div className="flex items-start justify-between gap-5"><div><p className="font-display text-2xl">{invoice.familyName}</p><p className="mt-1 text-sm text-muted">{invoice.label} · <span className="capitalize">{invoice.status.replaceAll("_", " ")}</span></p></div><p className="text-xl">{money(invoice.amountDueCents, invoice.currency)}</p></div><div className="mt-5 divide-y divide-line border-y border-line">{invoice.lines.map((line) => <div key={line.id} className="grid grid-cols-[1fr_auto] gap-4 py-3 text-sm"><div><p>{line.description}</p>{line.serviceDate ? <p className="mt-1 text-xs text-muted">{line.serviceDate}</p> : null}{["lesson","lesson_series"].includes(line.sourceType)&&(invoice.status==="draft"||invoice.status==="review")?<BillingLineDefer schoolId={schoolId} billingAccountId={invoice.billingAccountId} billingPeriodId={invoice.id} lineItemId={line.id} description={line.description} onRemoved={()=>loadPreparedInvoice(schoolId,invoice.billingAccountId,invoice.id).then((refreshed)=>{if(refreshed)updateInvoice(invoice.id,refreshed);})}/>:null}</div><p>{money(line.amountCents, invoice.currency)}</p></div>)}</div></div>
      {message ? <p role="status" className="mb-4 border-l-2 border-brand pl-3 text-sm">{message}</p> : null}
      {invoice.status === "draft" || invoice.status === "review" ? <><BillingAdjustmentForm key={invoice.id} schoolId={schoolId} billingAccountId={invoice.billingAccountId} billingPeriodId={invoice.id} outstandingLessons={invoice.outstandingLessons} embedded onEditingChange={setAdjustmentEditing} onChanged={() => { void loadPreparedInvoice(schoolId, invoice.billingAccountId, invoice.id).then((refreshed) => { if (refreshed) updateInvoice(invoice.id, refreshed); }); }} /><div className="mt-5"><HoldToConfirm action={() => lockFamilyBillingPeriod(schoolId, invoice.billingAccountId, invoice.id)} disabled={adjustmentEditing} disabledMessage="Finish or cancel the open adjustment before locking this amount." idleLabel="Hold to lock this exact amount" holdingLabel="Keep holding to freeze the invoice…" successLabel="Invoice locked" onSuccess={() => { updateInvoice(invoice.id, { status: "locked" }); setMessage("Invoice locked. It is ready to send for payer approval."); }} /></div></> : null}
      {invoice.status === "locked" ? <button type="button" disabled={pending} onClick={() => startTransition(async () => { const result = await sendBillingApprovalEmail(schoolId, invoice.billingAccountId, invoice.id, { ok: false, message: "" }); setMessage(result.message); if (result.ok) updateInvoice(invoice.id, { status: "approval_pending" }); })} className="w-full rounded-control bg-brand px-5 py-3 text-sm text-canvas disabled:opacity-50">{pending ? "Sending…" : "Send for payer approval"}</button> : null}
      {invoice.status === "approval_pending" ? <p className="rounded-control bg-brand/10 p-4 text-sm text-brand">Approval request sent. This invoice is waiting for the payer.</p> : null}
      <div className="mt-5 flex flex-wrap justify-between gap-3"><button type="button" onClick={() => { setAdjustmentEditing(false); setPayer(null); setSearch(""); setMessage(""); setQueueIndex(queue.length); }} className="text-sm text-brand">Prepare another invoice</button><a href={`/schools/${schoolId}/families/${invoice.billingAccountId}?period=${invoice.id}`} className="text-sm text-muted hover:text-brand">Open full invoice →</a></div>
    </div> : payer ? <form action={prepare} className="grid gap-6"><div><p className="text-sm">{payer.name}</p><p className="mt-1 text-xs text-muted">{payer.students.join(" · ") || "No students connected"}</p></div><label><span className="block text-xs text-muted">Service month</span><input required type="month" name="month" value={month} onChange={(event) => setMonth(event.target.value)} onClick={(event) => event.currentTarget.showPicker?.()} className="mt-2 w-full cursor-pointer rounded-control border border-line bg-canvas px-3 py-3 outline-none focus:border-brand" /></label>{message ? <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">{message}</p> : null}<div className="flex items-center justify-between gap-4"><button type="button" onClick={() => setPayer(null)} className="text-sm text-muted">Choose someone else</button><button disabled={pending} className="rounded-control bg-brand px-5 py-3 text-sm text-canvas disabled:opacity-50">{pending ? "Preparing…" : "Prepare invoice →"}</button></div></form>
    : <><label className="flex items-center gap-3 rounded-control border border-line bg-canvas px-4 focus-within:border-brand"><MdSearch aria-hidden="true" className="shrink-0 text-lg text-muted" /><span className="sr-only">Search payers and students</span><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search a payer or student…" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted" /></label><div className="mt-4 max-h-80 overflow-y-auto border-t border-line pt-3">{filtered.length ? filtered.map((choice) => <button key={choice.id} type="button" onClick={() => { setPayer(choice); setMessage(""); }} className="block w-full rounded-control px-4 py-3 text-left transition hover:bg-brand/10"><span className="block text-sm text-ink">{choice.name}</span><span className="mt-1 block text-xs text-muted">{choice.students.length ? choice.students.join(" · ") : "No students connected"}</span></button>) : <p className="px-4 py-8 text-center text-sm text-muted">No payer or student matches that search.</p>}</div></>}
  </FocusedModal>;
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
