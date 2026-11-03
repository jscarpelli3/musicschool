"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MdClose, MdOpenInNew } from "react-icons/md";
import type { SchoolInvoice } from "@/lib/billing/school-invoices";
import { AppSelect } from "@/components/ui/app-select";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { CommonTimeLoader } from "@/components/ui/common-time-loader";
import { InvoicePaymentCollection } from "@/components/billing/invoice-payment-collection";
import { BillingAdjustmentForm } from "@/app/schools/[schoolId]/families/[billingAccountId]/billing-adjustments";
import { BillingLineDefer } from "@/app/schools/[schoolId]/families/[billingAccountId]/billing-line-defer";
import { discardEditableInvoice, loadPreparedInvoice, lockFamilyBillingPeriod, sendBillingApprovalEmail, type PreparedInvoice } from "@/app/schools/[schoolId]/families/[billingAccountId]/actions";
import { payerReviewReasonLabel } from "@/lib/billing/approval-review";
import { invoiceLinePrimary, invoiceLineSecondary } from "@/lib/billing/invoice-line-presentation";

type SortKey = "recent" | "status" | "payer" | "student";
const money = (amount: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
const timestamp = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
function periodRange(start:string,end:string){
  const startDate=new Date(`${start}T12:00:00Z`),endDate=new Date(`${end}T12:00:00Z`);
  const startYear=startDate.getUTCFullYear(),endYear=endDate.getUTCFullYear(),startMonth=startDate.getUTCMonth(),endMonth=endDate.getUTCMonth();
  if(startYear===endYear&&startMonth===endMonth)return `${new Intl.DateTimeFormat("en-US",{month:"short",timeZone:"UTC"}).format(startDate)} ${startDate.getUTCDate()}–${endDate.getUTCDate()}, ${endYear}`;
  if(startYear===endYear)return `${new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",timeZone:"UTC"}).format(startDate)}–${new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(endDate)}`;
  return `${new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(startDate)}–${new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(endDate)}`;
}

export function InvoiceWorkspaceList({ schoolId, invoices, compact, autoOpenId = null, hideList = false, onClose }: { schoolId: string; invoices: SchoolInvoice[]; compact: boolean; autoOpenId?: string | null; hideList?: boolean; onClose?: () => void }) {
  const router=useRouter();
  const [sort, setSort] = useState<SortKey>("recent");
  const [selected, setSelected] = useState<SchoolInvoice | null>(() => (autoOpenId ? (invoices.find((item) => item.id === autoOpenId) ?? null) : null));
  const [detail, setDetail] = useState<PreparedInvoice | null>(null);
  const [loading, setLoading] = useState(Boolean(autoOpenId));
  const [adjustmentEditing, setAdjustmentEditing] = useState(false);
  const [draftToCancel,setDraftToCancel]=useState<SchoolInvoice|null>(null);
  const sorted = useMemo(() => [...invoices].sort((a, b) => (sort === "recent" ? b.updatedAt.localeCompare(a.updatedAt) : sort === "payer" ? a.familyName.localeCompare(b.familyName) || b.updatedAt.localeCompare(a.updatedAt) : sort === "student" ? a.studentNames.join(", ").localeCompare(b.studentNames.join(", ")) || a.familyName.localeCompare(b.familyName) : a.statusLabel.localeCompare(b.statusLabel) || b.updatedAt.localeCompare(a.updatedAt))), [invoices, sort]);

  async function open(invoice: SchoolInvoice) {
    setAdjustmentEditing(false);
    setSelected(invoice);
    setDetail(null);
    setLoading(true);
    setDetail(await loadPreparedInvoice(schoolId, invoice.billingAccountId, invoice.id));
    setLoading(false);
  }
  function close() {
    setAdjustmentEditing(false);
    setSelected(null);
    setDetail(null);
    onClose?.();
  }
  async function refresh() {
    if (!selected) return;
    const next = await loadPreparedInvoice(schoolId, selected.billingAccountId, selected.id);
    setDetail(next);
    if (next) setSelected((current) => (current && current.status !== next.status ? { ...current, status: next.status } : current));
  }

  useEffect(() => {
    if (!autoOpenId || !selected || detail) return;
    let active = true;
    void loadPreparedInvoice(schoolId, selected.billingAccountId, selected.id).then((next) => {
      if (!active) return;
      setDetail(next);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [autoOpenId, detail, schoolId, selected]);

  if (!invoices.length && !hideList) return <p className="py-5 text-sm text-muted">No invoices have been prepared.</p>;
  return (
    <>
      {!hideList ? (
        <>
          <div className="mb-4 flex items-center justify-end gap-2">
            <label className="flex items-center gap-2 text-xs text-muted">
              <span>Sort by</span>
              <AppSelect value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="min-w-36 rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink">
                <option value="recent">Most recent</option>
                <option value="status">Status</option>
                <option value="payer">Payer name</option>
                <option value="student">Student name</option>
              </AppSelect>
            </label>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {sorted.map((invoice) => {
              const sentBack = Boolean(invoice.payerReviewReason || invoice.payerReviewNote);
              const statusClass = sentBack ? "border-danger/60 bg-danger/10 text-danger" : invoice.status === "paid" ? "border-brand/50 bg-brand text-canvas" : invoice.status === "draft" || invoice.status === "review" ? "border-ink/25 bg-ink/10 text-ink" : "border-brand/30 bg-brand/10 text-brand";
              const editable=invoice.status==="draft"||invoice.status==="review";
              return (
                <article key={invoice.id}>
                <button type="button" onClick={() => void open(invoice)} className={`${compact ? "px-1 py-3" : "px-3 py-3 sm:px-4"} w-full text-left transition hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`}>
                  <span className={`grid gap-3 ${compact ? "sm:grid-cols-[minmax(0,1fr)_9rem]" : "sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.2fr)_9rem]"} sm:items-center`}>
                    <span className="min-w-0">
                      <span className="font-medium">{invoice.familyName}</span>
                      {invoice.studentNames.length ? <span className="mt-1 block text-xs text-muted">{invoice.studentNames.join(" · ")}</span> : null}
                      {compact ? <span className="mt-1 block text-xs text-muted">{invoice.label} · {invoice.lineCount} {invoice.lineCount===1?"line":"lines"}</span> : null}
                    </span>
                    {!compact ? <span className="text-xs leading-5 text-muted"><span className="block font-medium text-ink">{invoice.label}</span><span className="block">{periodRange(invoice.periodStart,invoice.periodEnd)} · {invoice.lineCount} {invoice.lineCount===1?"line":"lines"}</span></span> : null}
                    {!compact ? <span className="text-xs leading-5 text-muted"><span className="block">Created {timestamp(invoice.createdAt)}</span>{invoice.approvedAt?<span className="block">Approved {timestamp(invoice.approvedAt)}</span>:invoice.approvalSentAt?<span className="block">Sent for approval {timestamp(invoice.approvalSentAt)}</span>:<span className="block">Updated {timestamp(invoice.updatedAt)}</span>}</span> : null}
                    <span className="sm:text-right">
                      <span className="block text-sm">{money(invoice.amountDueCents, invoice.currency)}</span>
                      <span className="mt-1 flex flex-wrap gap-1.5 sm:justify-end">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] ${statusClass}`}>{sentBack ? "Sent back for review" : invoice.status === "draft" || invoice.status === "review" ? "Resume draft" : invoice.statusLabel}</span>
                        {invoice.hasFailedPayment && invoice.status !== "paid" ? <span className="inline-flex rounded-full border border-danger/60 bg-danger/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-danger">Payment failed</span> : null}
                      </span>
                    </span>
                  </span>
                  {sentBack ? (
                    <span className="mt-3 block border-l-2 border-danger pl-3 text-sm text-ink">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-danger">Payer’s review request</span>
                      <span className="mt-1 block">{payerReviewReasonLabel(invoice.payerReviewReason)}</span>
                      {invoice.payerReviewNote ? <span className="mt-1 block text-xs leading-5 text-muted">“{invoice.payerReviewNote}”</span> : null}
                    </span>
                  ) : null}
                </button>
                {editable?<div className={`flex justify-end ${compact?"px-1":"px-4"} pb-2`}><button type="button" onClick={()=>setDraftToCancel(invoice)} className="text-xs text-danger underline-offset-4 hover:underline">Cancel draft</button></div>:null}
                </article>
              );
            })}
          </div>
        </>
      ) : null}
      {draftToCancel?<div className="fixed inset-0 z-[140] grid place-items-center px-5" role="dialog" aria-modal="true" aria-labelledby="cancel-draft-title"><button type="button" aria-label="Close cancellation confirmation" onClick={()=>setDraftToCancel(null)} className="absolute inset-0 bg-[var(--ui-overlay)]"/><section className="relative w-full max-w-md rounded-card border border-danger/40 bg-canvas p-6 shadow-2xl"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-danger">Unfinished invoice</p><h2 id="cancel-draft-title" className="mt-2 font-display text-3xl">Cancel this draft?</h2><p className="mt-3 text-sm leading-6 text-muted">This removes the unfinished {draftToCancel.label} invoice for {draftToCancel.familyName} and releases its lessons. Approved, paid, void, and other historical invoices can never be removed here.</p><div className="mt-5"><HoldToConfirm compact action={()=>discardEditableInvoice(schoolId,draftToCancel.billingAccountId,draftToCancel.id)} idleLabel="Hold to cancel draft" holdingLabel="Keep holding to remove the draft…" submittingLabel="Cancelling draft…" successLabel="Draft cancelled" onSuccess={()=>{setDraftToCancel(null);router.refresh();}}/></div><button type="button" onClick={()=>setDraftToCancel(null)} className="mt-1 text-sm text-muted">Keep draft</button></section></div>:null}
      {selected ? (
        <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-labelledby="invoice-workspace-title">
          <button type="button" aria-label="Close invoice" onClick={close} className="absolute inset-0 bg-[var(--ui-overlay)]" />
          <section className="absolute left-1/2 top-1/2 max-h-[calc(100dvh-2rem)] w-[min(46rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card border border-brand/30 bg-canvas p-6 shadow-2xl sm:p-8">
            <header className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-brand">Invoice workspace</p>
                <h2 id="invoice-workspace-title" className="mt-2 font-display text-3xl">
                  {selected.familyName}
                </h2>
                <p className="mt-2 text-sm text-muted">{selected.studentNames.join(" · ") || "No students linked"}</p>
              </div>
              <button type="button" onClick={close} aria-label="Close" className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-surface-raised hover:text-ink">
                <MdClose className="text-2xl" />
              </button>
            </header>
            {loading ? (
              <CommonTimeLoader label="Loading invoice…" compact showBrand={false} />
            ) : detail ? (
              <div className="mt-7">
                {detail.payerReviewReason || detail.payerReviewNote ? (
                  <div className="mb-5 rounded-control border-2 border-danger bg-danger/10 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-danger">This invoice was sent back for review</p>
                    <p className="mt-3 text-sm">{payerReviewReasonLabel(detail.payerReviewReason)}</p>
                    {detail.payerReviewNote ? <p className="mt-2 text-sm leading-6 text-muted">“{detail.payerReviewNote}”</p> : null}
                  </div>
                ) : null}
                <div className="flex items-end justify-between gap-5 rounded-control bg-surface-raised p-5">
                  <div>
                    <p className="font-medium">{detail.label}</p>
                    <p className="mt-1 text-xs capitalize text-muted">
                      {detail.status.replaceAll("_", " ")} · {detail.lines.length} line
                      {detail.lines.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="text-xl">{money(detail.amountDueCents, detail.currency)}</p>
                </div>
                <div className="mt-5 divide-y divide-line border-y border-line">
                  {detail.lines.map((line) => (
                    <div key={line.id} className="grid grid-cols-[1fr_auto] gap-4 py-3 text-sm">
                      <div>
                        <p className="font-medium">{invoiceLinePrimary(line)}</p>
                        <p className="mt-1 text-xs text-muted">{invoiceLineSecondary(line)}</p>
                        {["lesson", "lesson_series"].includes(line.sourceType) && (detail.status === "draft" || detail.status === "review") ? <BillingLineDefer schoolId={schoolId} billingAccountId={detail.billingAccountId} billingPeriodId={detail.id} lineItemId={line.id} description={line.description} onRemoved={refresh} /> : null}
                      </div>
                      <p>{money(line.amountCents, detail.currency)}</p>
                    </div>
                  ))}
                </div>
                {detail.status === "draft" || detail.status === "review" ? (
                  <>
                    <BillingAdjustmentForm schoolId={schoolId} billingAccountId={detail.billingAccountId} billingPeriodId={detail.id} outstandingLessons={detail.outstandingLessons} embedded onEditingChange={setAdjustmentEditing} onChanged={() => void refresh()} />
                    <div className="mt-5">
                      <HoldToConfirm action={() => lockFamilyBillingPeriod(schoolId, detail.billingAccountId, detail.id)} disabled={adjustmentEditing} disabledMessage="Finish or cancel the open adjustment before locking this amount." idleLabel="Hold to lock this exact amount" holdingLabel="Keep holding to freeze the invoice…" successLabel="Invoice locked" onSuccess={() => void refresh()} />
                    </div>
                    <div className="mt-6 border-t border-line pt-5">
                      <p className="mb-3 text-xs leading-5 text-muted">Discarding removes this unfinished invoice and makes its lessons available for another invoice.</p>
                      <HoldToConfirm compact action={() => discardEditableInvoice(schoolId, detail.billingAccountId, detail.id)} idleLabel="Hold to discard draft" holdingLabel="Keep holding to discard…" successLabel="Draft discarded" refreshOnSuccess />
                    </div>
                  </>
                ) : null}
                {detail.status === "locked" ? (
                  <div className="mt-6">
                    <p className="mb-3 text-sm text-muted">The amount is locked. Holding below creates the payer’s approval request and emails the itemized invoice.</p>
                    <HoldToConfirm prominent centered action={() => sendBillingApprovalEmail(schoolId, detail.billingAccountId, detail.id, { ok: false, message: "" })} idleLabel="Hold to email payer approval" holdingLabel="Keep holding to send the approval…" submittingLabel="Sending approval email…" successLabel="Approval email sent" onSuccess={() => void refresh()} />
                  </div>
                ) : null}
                {detail.status === "approval_pending" ? <p className="mt-6 rounded-control bg-brand/10 p-4 text-sm text-brand">Waiting for the payer to review this exact amount.</p> : null}
                {["approved", "payment_failed", "collecting", "paid"].includes(detail.status) ? <InvoicePaymentCollection schoolId={schoolId} billingAccountId={detail.billingAccountId} billingPeriodId={detail.id} amount={money(detail.amountDueCents, detail.currency)} amountCents={detail.amountDueCents} currency={detail.currency} hasPaymentMethod={detail.hasActivePaymentMethod} initialStatus={detail.status} initialAttempt={detail.latestPaymentAttempt} initialSettlements={detail.settlements} initialOutstandingCents={detail.outstandingCents} stripePayments={detail.stripePayments} stripeRefunds={detail.stripeRefunds} /> : null}
                <div className="mt-6 flex justify-end">
                  <Link href={`/schools/${schoolId}/families/${detail.billingAccountId}?period=${detail.id}`} className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand">
                    Open the full family record <MdOpenInNew />
                  </Link>
                </div>
              </div>
            ) : (
              <p role="alert" className="py-12 text-center text-sm text-danger">
                This invoice could not be loaded. Open the family record and try again.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
