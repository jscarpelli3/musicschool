"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MdClose, MdOpenInNew } from "react-icons/md";
import type { SchoolInvoice } from "@/lib/billing/school-invoices";
import { AppSelect } from "@/components/ui/app-select";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { BillingAdjustmentForm } from "@/app/schools/[schoolId]/families/[billingAccountId]/billing-adjustments";
import { collectFamilyInvoice, createOneTimeInvoicePaymentLink, loadPreparedInvoice, lockFamilyBillingPeriod, sendBillingApprovalEmail, type PreparedInvoice } from "@/app/schools/[schoolId]/families/[billingAccountId]/actions";
import { payerReviewReasonLabel } from "@/lib/billing/approval-review";

type SortKey = "status" | "payer" | "student";
const money = (amount: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);

export function InvoiceWorkspaceList({ schoolId, invoices, compact, autoOpenId = null, hideList = false, onClose }: { schoolId: string; invoices: SchoolInvoice[]; compact: boolean; autoOpenId?: string | null; hideList?: boolean; onClose?: () => void }) {
  const [sort, setSort] = useState<SortKey>("status");
  const [selected, setSelected] = useState<SchoolInvoice | null>(() => autoOpenId ? invoices.find((item) => item.id === autoOpenId) ?? null : null);
  const [detail, setDetail] = useState<PreparedInvoice | null>(null);
  const [loading, setLoading] = useState(Boolean(autoOpenId));
  const [adjustmentEditing, setAdjustmentEditing] = useState(false);
  const [paymentLinkPending, setPaymentLinkPending] = useState(false);
  const [paymentLinkMessage, setPaymentLinkMessage] = useState("");
  const [paymentLinkCopied, setPaymentLinkCopied] = useState(false);
  const [watchedPaymentAttemptId, setWatchedPaymentAttemptId] = useState<string | null>(null);
  const [paymentResultMessage, setPaymentResultMessage] = useState("");
  const sorted = useMemo(() => [...invoices].sort((a, b) => sort === "payer" ? a.familyName.localeCompare(b.familyName) || b.updatedAt.localeCompare(a.updatedAt) : sort === "student" ? a.studentNames.join(", ").localeCompare(b.studentNames.join(", ")) || a.familyName.localeCompare(b.familyName) : a.statusLabel.localeCompare(b.statusLabel) || b.updatedAt.localeCompare(a.updatedAt)), [invoices, sort]);

  async function open(invoice: SchoolInvoice) { setAdjustmentEditing(false); setPaymentLinkMessage(""); setPaymentLinkCopied(false); setWatchedPaymentAttemptId(null); setPaymentResultMessage(""); setSelected(invoice); setDetail(null); setLoading(true); setDetail(await loadPreparedInvoice(schoolId, invoice.billingAccountId, invoice.id)); setLoading(false); }
  function close() { setAdjustmentEditing(false); setPaymentLinkMessage(""); setPaymentLinkCopied(false); setWatchedPaymentAttemptId(null); setPaymentResultMessage(""); setSelected(null); setDetail(null); onClose?.(); }
  async function refresh() { if (!selected) return; const next = await loadPreparedInvoice(schoolId, selected.billingAccountId, selected.id); setDetail(next); if (next) setSelected((current) => current && current.status !== next.status ? { ...current, status: next.status } : current); }

  async function startWatchingPayment() {
    if (!selected) return;
    const next = await loadPreparedInvoice(schoolId, selected.billingAccountId, selected.id);
    setDetail(next);
    if (next) {
      setSelected((current) => current && current.status !== next.status ? { ...current, status: next.status } : current);
      setWatchedPaymentAttemptId(next.latestPaymentAttempt?.id ?? null);
      setPaymentResultMessage("Watching for Stripe’s confirmation…");
    }
  }

  useEffect(() => {
    if (!autoOpenId || !selected || detail) return;
    let active = true;
    void loadPreparedInvoice(schoolId, selected.billingAccountId, selected.id).then((next) => {
      if (!active) return;
      setDetail(next);
      setLoading(false);
    });
    return () => { active = false; };
  }, [autoOpenId, detail, schoolId, selected]);

  useEffect(() => {
    if (!selected || !watchedPaymentAttemptId) return;
    let active = true;
    const check = async () => {
      const next = await loadPreparedInvoice(schoolId, selected.billingAccountId, selected.id);
      if (!active || !next) return;
      setDetail(next);
      setSelected((current) => current && current.status !== next.status ? { ...current, status: next.status } : current);
      const attempt = next.latestPaymentAttempt;
      if (next.status === "paid" || attempt?.status === "succeeded") {
        setPaymentResultMessage("Payment confirmed. This invoice is paid.");
        setWatchedPaymentAttemptId(null);
      } else if (attempt?.id === watchedPaymentAttemptId && ["failed", "requires_action", "cancelled"].includes(attempt.status)) {
        setPaymentResultMessage(attempt.failureMessage ? `Payment failed: ${attempt.failureMessage}` : "Payment did not complete. No successful charge was recorded; review the payment method before trying again.");
        setWatchedPaymentAttemptId(null);
      }
    };
    const interval = window.setInterval(() => void check(), 3000);
    void check();
    return () => { active = false; window.clearInterval(interval); };
  }, [schoolId, selected, watchedPaymentAttemptId]);

  if (!invoices.length && !hideList) return <p className="py-5 text-sm text-muted">No invoices have been prepared.</p>;
  return <>
    {!hideList ? <><div className="mb-4 flex items-center justify-end gap-2"><label className="flex items-center gap-2 text-xs text-muted"><span>Sort by</span><AppSelect value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="min-w-36 rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink"><option value="status">Status</option><option value="payer">Payer name</option><option value="student">Student name</option></AppSelect></label></div>
    <div className={compact ? "divide-y divide-line" : "grid gap-3"}>{sorted.map((invoice) => {
      const sentBack = Boolean(invoice.payerReviewReason || invoice.payerReviewNote);
      const statusClass = sentBack ? "border-danger/60 bg-danger/10 text-danger" : invoice.status === "paid" ? "border-brand/50 bg-brand text-canvas" : invoice.status === "draft" || invoice.status === "review" ? "border-ink/25 bg-ink/10 text-ink" : "border-brand/30 bg-brand/10 text-brand";
      return <button type="button" key={invoice.id} onClick={() => void open(invoice)} className={`${compact ? "py-4" : "ui-card p-5 sm:p-6"} w-full text-left transition hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`}><span className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center"><span><span className="font-medium">{invoice.familyName}</span>{invoice.studentNames.length ? <span className="mt-1 block text-xs text-muted">{invoice.studentNames.join(" · ")}</span> : null}<span className="mt-1 block text-xs text-muted">{invoice.label} · {invoice.periodStart}–{invoice.periodEnd}</span></span><span className="sm:text-right"><span className="block text-sm">{money(invoice.amountDueCents, invoice.currency)}</span><span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${statusClass}`}>{sentBack ? "Sent back for review" : invoice.statusLabel}</span></span></span>{sentBack ? <span className="mt-4 block rounded-control border border-danger/30 bg-danger/10 p-3 text-sm text-ink"><span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-danger">Payer’s review request</span><span className="mt-1 block">{payerReviewReasonLabel(invoice.payerReviewReason)}</span>{invoice.payerReviewNote ? <span className="mt-1 block text-xs leading-5 text-muted">“{invoice.payerReviewNote}”</span> : null}</span> : null}</button>;
    })}</div></> : null}
    {selected ? <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-labelledby="invoice-workspace-title"><button type="button" aria-label="Close invoice" onClick={close} className="absolute inset-0 bg-[var(--ui-overlay)]" /><section className="absolute left-1/2 top-1/2 max-h-[calc(100dvh-2rem)] w-[min(46rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card border border-brand/30 bg-canvas p-6 shadow-2xl sm:p-8">
      <header className="flex items-start justify-between gap-5"><div><p className="text-xs uppercase tracking-[0.14em] text-brand">Invoice workspace</p><h2 id="invoice-workspace-title" className="mt-2 font-display text-3xl">{selected.familyName}</h2><p className="mt-2 text-sm text-muted">{selected.studentNames.join(" · ") || "No students linked"}</p></div><button type="button" onClick={close} aria-label="Close" className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-surface-raised hover:text-ink"><MdClose className="text-2xl" /></button></header>
      {loading ? <p className="py-12 text-center text-sm text-muted">Loading invoice…</p> : detail ? <div className="mt-7">{detail.payerReviewReason || detail.payerReviewNote ? <div className="mb-5 rounded-control border-2 border-danger bg-danger/10 p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-danger">This invoice was sent back for review</p><p className="mt-3 text-sm">{payerReviewReasonLabel(detail.payerReviewReason)}</p>{detail.payerReviewNote ? <p className="mt-2 text-sm leading-6 text-muted">“{detail.payerReviewNote}”</p> : null}</div> : null}<div className="flex items-end justify-between gap-5 rounded-control bg-surface-raised p-5"><div><p className="font-medium">{detail.label}</p><p className="mt-1 text-xs capitalize text-muted">{detail.status.replaceAll("_", " ")} · {detail.lines.length} line{detail.lines.length === 1 ? "" : "s"}</p></div><p className="text-xl">{money(detail.amountDueCents, detail.currency)}</p></div>
        <div className="mt-5 divide-y divide-line border-y border-line">{detail.lines.map((line) => <div key={line.id} className="grid grid-cols-[1fr_auto] gap-4 py-3 text-sm"><div><p>{line.description}</p>{line.serviceDate ? <p className="mt-1 text-xs text-muted">{line.serviceDate}</p> : null}</div><p>{money(line.amountCents, detail.currency)}</p></div>)}</div>
        {detail.status === "draft" || detail.status === "review" ? <><BillingAdjustmentForm schoolId={schoolId} billingAccountId={detail.billingAccountId} billingPeriodId={detail.id} outstandingLessons={detail.outstandingLessons} embedded onEditingChange={setAdjustmentEditing} onChanged={() => void refresh()} /><div className="mt-5"><HoldToConfirm action={() => lockFamilyBillingPeriod(schoolId, detail.billingAccountId, detail.id)} disabled={adjustmentEditing} disabledMessage="Finish or cancel the open adjustment before locking this amount." idleLabel="Hold to lock this exact amount" holdingLabel="Keep holding to freeze the invoice…" successLabel="Invoice locked" onSuccess={() => void refresh()} /></div></> : null}
        {detail.status === "locked" ? <div className="mt-6"><p className="mb-3 text-sm text-muted">The amount is locked. Holding below creates the payer’s approval request and emails the itemized invoice.</p><HoldToConfirm prominent centered action={() => sendBillingApprovalEmail(schoolId, detail.billingAccountId, detail.id, { ok: false, message: "" })} idleLabel="Hold to email payer approval" holdingLabel="Keep holding to send the approval…" submittingLabel="Sending approval email…" successLabel="Approval email sent" onSuccess={() => void refresh()} /></div> : null}
        {detail.status === "approval_pending" ? <p className="mt-6 rounded-control bg-brand/10 p-4 text-sm text-brand">Waiting for the payer to review this exact amount.</p> : null}
        {detail.status === "approved" || detail.status === "payment_failed" ? <div className="mt-6 grid gap-5"><div><HoldToConfirm prominent centered action={() => collectFamilyInvoice(schoolId, detail.billingAccountId, detail.id)} idleLabel={detail.status === "payment_failed" ? "Hold to try the saved card again" : `Hold to charge saved card ${money(detail.amountDueCents, detail.currency)}`} holdingLabel="Keep holding to submit the charge…" submittingLabel="Submitting securely…" successLabel="Payment submitted" onSuccess={() => void startWatchingPayment()} /></div><div className="rounded-control bg-surface-raised p-5"><p className="text-sm font-medium">No active card on file?</p><p className="mt-2 text-xs leading-5 text-muted">Create a short-lived Stripe link for this exact invoice. The payer enters their card securely, and it is not authorized for future school charges.</p><button type="button" disabled={paymentLinkPending} onClick={async () => { setPaymentLinkPending(true); setPaymentLinkMessage(""); const result = await createOneTimeInvoicePaymentLink(schoolId, detail.billingAccountId, detail.id); if (result.ok && result.url) { try { await navigator.clipboard.writeText(result.url); setPaymentLinkCopied(true); setPaymentLinkMessage("Copied. Send this link directly to the payer."); } catch { setPaymentLinkCopied(false); setPaymentLinkMessage(`Copy this payment link: ${result.url}`); } await startWatchingPayment(); } else setPaymentLinkMessage(result.message); setPaymentLinkPending(false); }} className="mt-4 rounded-control border border-brand px-4 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:cursor-wait disabled:opacity-50">{paymentLinkPending ? "Preparing link…" : paymentLinkCopied ? "Copy link again" : "Copy one-time payment link"}</button>{paymentLinkMessage ? <p role="status" className="mt-3 break-words text-sm font-medium leading-5 text-brand">{paymentLinkMessage}</p> : null}<p className="mt-3 text-xs leading-5 text-muted">This window checks automatically for payment while it remains open. If the status does not update, refresh the page after the payer finishes.</p></div></div> : null}
        {detail.status === "collecting" ? <p className="mt-6 rounded-control bg-brand/10 p-4 text-sm text-brand">Payment submitted — awaiting Stripe confirmation. This window checks automatically. Do not submit another charge.</p> : null}{detail.status === "paid" ? <p className="mt-6 rounded-control bg-brand/10 p-4 text-sm font-medium text-brand">Paid. Stripe confirmed the payment; no further action is needed.</p> : null}{paymentResultMessage ? <p role="status" className={`mt-4 rounded-control p-4 text-sm ${detail.status === "payment_failed" ? "bg-danger/10 text-danger" : "bg-surface-raised text-ink"}`}>{paymentResultMessage}</p> : null}
        <div className="mt-6 flex justify-end"><Link href={`/schools/${schoolId}/families/${detail.billingAccountId}?period=${detail.id}`} className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand">Open the full family record <MdOpenInNew /></Link></div>
      </div> : <p role="alert" className="py-12 text-center text-sm text-danger">This invoice could not be loaded. Open the family record and try again.</p>}
    </section></div> : null}
  </>;
}
