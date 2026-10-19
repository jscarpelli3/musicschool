"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { OwnerNotifications } from "@/components/notifications/owner-notifications";
import type { SchoolInvoice } from "@/lib/billing/school-invoices";
import { MdApproval, MdDashboard, MdExpandMore, MdFamilyRestroom, MdGroups, MdReceiptLong, MdSchool, MdSearch } from "react-icons/md";
import { HeaderLessonFinder } from "@/components/scheduling/header-lesson-finder";
import type { LessonCreationOptions } from "@/components/scheduling/lesson-creation-dialog";
import { PrepareInvoiceLauncher, type InvoicePayerChoice } from "@/components/billing/prepare-invoice-launcher";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { lockFamilyBillingPeriod, sendBillingApprovalEmail } from "@/app/schools/[schoolId]/families/[billingAccountId]/actions";

type RecentApproval = { id: string; kind: "schedule_proposal" | "lesson_change_request"; status: string; teacherId: string; studentId: string; teacher: string; student: string; detail: string };

type DirectoryItem = { id: string; label: string };
type InvoiceSendProgress = "waiting" | "sending" | "sent" | "failed";

export function SchoolManagementNav({ schoolId, timeZone, lessonCreationOptions, studentIdsByFamily = {}, invoicePayers = [], capabilities, approvalCount = 0, recentApprovals = [], finishedApprovals = [], invoiceCount = 0, recentInvoices = [], students = [], families = [], staff = [] }: { schoolId: string; timeZone: string; lessonCreationOptions?: LessonCreationOptions; studentIdsByFamily?: Record<string, string[]>; invoicePayers?: InvoicePayerChoice[]; capabilities: string[]; approvalCount?: number; recentApprovals?: RecentApproval[]; finishedApprovals?: RecentApproval[]; invoiceCount?: number; recentInvoices?: SchoolInvoice[]; students?: DirectoryItem[]; families?: DirectoryItem[]; staff?: DirectoryItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [approvalView, setApprovalView] = useState<"pending" | "finished">("pending");
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState<"students" | "families" | "staff" | null>(null);
  const [directorySearch, setDirectorySearch] = useState("");
  const [invoiceSelection, setInvoiceSelection] = useState<string[]>([]);
  const [invoiceMessage, setInvoiceMessage] = useState("");
  const [invoiceSendProgress, setInvoiceSendProgress] = useState<Record<string, InvoiceSendProgress>>({});
  const [invoiceActionPending, startInvoiceAction] = useTransition();
  const approvalsRef = useRef<HTMLDivElement>(null);
  const invoicesRef = useRef<HTMLDivElement>(null);
  const directoryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = () => setApprovalsOpen(false);
    window.addEventListener("common-time:open-notifications", close);
    window.addEventListener("common-time:open-invoices", close);
    window.addEventListener("common-time:open-lesson-drawer", close);
    window.addEventListener("common-time:open-directory", close);
    return () => { window.removeEventListener("common-time:open-notifications", close); window.removeEventListener("common-time:open-invoices", close); window.removeEventListener("common-time:open-lesson-drawer", close); window.removeEventListener("common-time:open-directory", close); };
  }, []);
  useEffect(() => {
    if (!approvalsOpen && !invoicesOpen && !directoryOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (approvalsRef.current?.contains(event.target) || invoicesRef.current?.contains(event.target) || directoryRef.current?.contains(event.target)) return;
      setApprovalsOpen(false);
      setInvoicesOpen(false);
      setDirectoryOpen(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setApprovalsOpen(false);
        setInvoicesOpen(false);
        setDirectoryOpen(null);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [approvalsOpen, invoicesOpen, directoryOpen]);
  useEffect(() => {
    const close = () => setInvoicesOpen(false);
    window.addEventListener("common-time:open-notifications", close);
    window.addEventListener("common-time:open-approvals", close);
    window.addEventListener("common-time:open-lesson-drawer", close);
    window.addEventListener("common-time:open-directory", close);
    return () => { window.removeEventListener("common-time:open-notifications", close); window.removeEventListener("common-time:open-approvals", close); window.removeEventListener("common-time:open-lesson-drawer", close); window.removeEventListener("common-time:open-directory", close); };
  }, []);
  const base = `/schools/${schoolId}`;
  const can = (capability: string) => capabilities.includes(capability);
  const dashboardHref = can("school.workspace.view") ? base : `${base}/teacher`;
  const selectedInvoices = recentInvoices.filter((invoice) => invoiceSelection.includes(invoice.id));
  const selectedToLock = selectedInvoices.filter((invoice) => invoice.status === "draft" || invoice.status === "review");
  const selectedToSend = selectedInvoices.filter((invoice) => invoice.status === "locked");
  const lockableInvoices = recentInvoices.filter((invoice) => invoice.status === "draft" || invoice.status === "review");
  const sendableInvoices = recentInvoices.filter((invoice) => invoice.status === "locked");
  const visibleApprovals = approvalView === "pending" ? recentApprovals : finishedApprovals;

  async function lockInvoices(invoices: SchoolInvoice[]) {
    const results = [];
    for (const invoice of invoices) results.push(await lockFamilyBillingPeriod(schoolId, invoice.billingAccountId, invoice.id));
    const failures = results.filter((result) => !result.ok);
    if (!failures.length) { setInvoiceSelection([]); setInvoiceMessage(`${invoices.length} invoice${invoices.length === 1 ? "" : "s"} locked and ready to send.`); router.refresh(); return { ok: true, message: "Invoices locked." }; }
    setInvoiceMessage(`${invoices.length - failures.length} locked; ${failures.length} could not be locked. Refresh and review those invoices.`);
    router.refresh();
    return { ok: false, message: failures[0].message };
  }

  async function sendInvoices(invoices: SchoolInvoice[]) {
    setInvoiceMessage("");
    setInvoiceSendProgress(Object.fromEntries(invoices.map((invoice) => [invoice.id, "waiting"])));
    const results = [];
    for (const invoice of invoices) {
      setInvoiceSendProgress((current) => ({ ...current, [invoice.id]: "sending" }));
      const result = await sendBillingApprovalEmail(schoolId, invoice.billingAccountId, invoice.id, { ok: false, message: "" });
      results.push(result);
      setInvoiceSendProgress((current) => ({ ...current, [invoice.id]: result.ok ? "sent" : "failed" }));
    }
    const failures = results.filter((result) => !result.ok);
    if (!failures.length) { setInvoiceSelection([]); setInvoiceMessage(`${invoices.length} approval request${invoices.length === 1 ? "" : "s"} sent.`); return { ok: true, message: "Approval requests sent." }; }
    setInvoiceMessage(`${invoices.length - failures.length} sent; ${failures.length} could not be sent. Review the payer email or invoice state.`);
    return { ok: false, message: failures[0].message };
  }
  const items = !can("school.workspace.view")
    ? [{ label: "My schedule", href: dashboardHref, active: pathname.startsWith(dashboardHref), icon: MdDashboard }]
    : [
        { label: "Dashboard", href: dashboardHref, active: pathname === dashboardHref, icon: MdDashboard },
        { label: "Students", href: `${base}/students`, active: pathname.startsWith(`${base}/students`), directory: "students" as const, icon: MdSchool },
        { label: "Families", href: `${base}/families`, active: pathname.startsWith(`${base}/families`), directory: "families" as const, icon: MdFamilyRestroom },
        ...(can("school.staff.directory_manage") ? [{ label: "Staff", href: `${base}/staff`, active: pathname.startsWith(`${base}/staff`), directory: "staff" as const, icon: MdGroups }] : []),
      ];

  return (
    <nav className="border-b border-line py-5" aria-label="School management">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
      {items.map((item) => {
        const Icon = item.icon;
        const directory = "directory" in item ? item.directory : null;
        if (!directory) return <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} className={`inline-flex items-center rounded-control border border-transparent px-3 py-1.5 text-sm transition-colors ${item.active ? "bg-[var(--school-section-tab)] text-ink shadow-sm" : "text-muted hover:bg-surface-raised/60 hover:text-ink"}`}><Icon aria-hidden="true" className="mr-1.5 text-base" />{item.label}</Link>;
        const open = directoryOpen === directory;
        const choices = directory === "students" ? students : directory === "families" ? families : staff;
        const filtered = choices.filter((choice) => choice.label.toLocaleLowerCase().includes(directorySearch.trim().toLocaleLowerCase()));
        return <div key={item.href} ref={open ? directoryRef : undefined} className={`relative z-40 flex items-center rounded-control border border-transparent transition-colors ${item.active ? "bg-[var(--school-section-tab)] text-ink shadow-sm" : "text-muted hover:bg-surface-raised/60 hover:text-ink"}`} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDirectoryOpen(null); }}>
          <Link href={item.href} aria-current={item.active ? "page" : undefined} className="inline-flex items-center py-1.5 pl-3 text-sm"><Icon aria-hidden="true" className="mr-1.5 text-base" />{item.label}</Link>
          <button type="button" aria-label={`Browse ${item.label.toLowerCase()}`} aria-expanded={open} onClick={() => { setDirectorySearch(""); setDirectoryOpen(open ? null : directory); if (!open) window.dispatchEvent(new Event("common-time:open-directory")); }} className="grid min-h-8 min-w-10 place-items-center text-current" title={`Browse ${item.label.toLowerCase()}`}><MdExpandMore aria-hidden="true" className={`text-xl transition ${open ? "rotate-180" : ""}`} /></button>
          {open ? <div className="absolute left-0 top-full w-[min(18rem,calc(100vw-2.5rem))] pt-1"><div className="rounded-card border border-brand/25 bg-surface-raised p-2 shadow-2xl">
            <label className="flex items-center gap-2 border-b border-line px-2"><MdSearch aria-hidden="true" className="shrink-0 text-muted" /><span className="sr-only">Search {item.label.toLowerCase()}</span><input autoFocus={false} value={directorySearch} onChange={(event) => setDirectorySearch(event.target.value)} placeholder={`Quick search ${item.label.toLowerCase()}…`} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted" /></label>
            <div className="mt-1 max-h-60 overflow-y-auto overscroll-contain">{filtered.length ? filtered.map((choice) => <Link key={choice.id} href={`${item.href}/${choice.id}`} onClick={() => setDirectoryOpen(null)} className="block rounded-control px-3 py-2 text-sm transition hover:bg-brand/15 hover:text-brand">{choice.label}</Link>) : <p className="px-3 py-4 text-sm text-muted">No matches.</p>}</div>
            <Link href={item.href} onClick={() => setDirectoryOpen(null)} className="mt-1 block border-t border-line px-3 pt-2.5 pb-1 text-xs text-brand">View all {item.label.toLowerCase()} →</Link>
          </div></div> : null}
        </div>;
      })}
      </div>
      <div className="ml-auto flex flex-wrap items-start justify-end gap-3 sm:gap-4">
        {can("school.billing.manage") ? <div ref={invoicesRef} className="relative z-30 flex flex-col items-end">
          <button type="button" aria-expanded={invoicesOpen} onClick={() => setInvoicesOpen((value) => { if (!value) window.dispatchEvent(new Event("common-time:open-invoices")); return !value; })} className="inline-flex items-center rounded-control border border-brand/40 bg-brand/10 px-3 py-1.5 text-sm text-brand transition hover:border-brand hover:bg-brand/15"><MdReceiptLong aria-hidden="true" className="mr-1.5 text-base" />Invoices{invoiceCount ? <span className="ml-2 inline-grid min-w-5 place-items-center rounded-full bg-brand px-1 text-xs text-canvas" aria-label={`${invoiceCount} open invoices`}>{invoiceCount}</span> : null}</button>
          <Link href={`${base}/invoices`} aria-current={pathname.startsWith(`${base}/invoices`) ? "page" : undefined} className="mt-0.5 text-[10px] leading-none text-muted hover:text-ink">View all</Link>
          {invoicesOpen ? <div className="ui-card absolute top-full right-0 mt-2 w-[min(32rem,calc(100vw-2.5rem))] p-4">
            <div className="flex items-center justify-between"><div><p className="font-display text-2xl">Invoice queue</p><p className="mt-1 text-xs text-muted">Review, lock, then send for approval.</p></div><button type="button" onClick={() => setInvoicesOpen(false)} className="text-sm text-muted hover:text-ink">Close</button></div>
            {recentInvoices.length ? <>
              <div className="mt-4 flex flex-wrap gap-2 border-y border-line py-3">
                <button type="button" disabled={!lockableInvoices.length} onClick={() => setInvoiceSelection(lockableInvoices.map((invoice) => invoice.id))} className="rounded-control border border-line px-3 py-1.5 text-xs text-brand disabled:opacity-40">Select all needing lock ({lockableInvoices.length})</button>
                <button type="button" disabled={!sendableInvoices.length} onClick={() => setInvoiceSelection(sendableInvoices.map((invoice) => invoice.id))} className="rounded-control border border-line px-3 py-1.5 text-xs text-brand disabled:opacity-40">Select all ready to send ({sendableInvoices.length})</button>
                {invoiceSelection.length ? <button type="button" onClick={() => setInvoiceSelection([])} className="px-2 text-xs text-muted">Clear</button> : null}
              </div>
              <div className="max-h-80 overflow-y-auto py-2">{recentInvoices.map((invoice) => {
                const actionable = ["draft", "review", "locked"].includes(invoice.status);
                const sendProgress = invoiceSendProgress[invoice.id];
                const queueStatusClass = invoice.status === "paid" ? "border-brand/50 bg-brand text-canvas" : invoice.status === "draft" || invoice.status === "review" ? "border-ink/25 bg-ink/10 text-ink" : invoice.status === "locked" ? "border-brand/40 bg-brand/15 text-brand" : "border-line bg-surface text-muted";
                return <div key={invoice.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-control px-2 py-3 hover:bg-brand/10">
                  <input type="checkbox" aria-label={`Select ${invoice.familyName} ${invoice.label}`} disabled={!actionable || invoiceActionPending || Boolean(sendProgress)} checked={invoiceSelection.includes(invoice.id)} onChange={(event) => setInvoiceSelection((current) => event.target.checked ? [...current, invoice.id] : current.filter((id) => id !== invoice.id))} className="mt-1 size-4 accent-current" />
                  <Link href={`${base}/families/${invoice.billingAccountId}?period=${invoice.id}`} onClick={() => setInvoicesOpen(false)}><p className="text-sm">{invoice.familyName}</p><p className="mt-1 text-xs text-muted">{invoice.label} · {invoice.lineCount} lines</p><span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] ${queueStatusClass}`}>{invoice.status === "draft" || invoice.status === "review" ? "Not locked" : invoice.status === "locked" ? "Locked · approval not sent" : invoice.statusLabel}</span></Link>
                  <div className="text-right"><p className="text-sm">{new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency }).format(invoice.amountDueCents / 100)}</p>{sendProgress ? <p role="status" className={`mt-2 text-xs font-medium ${sendProgress === "failed" ? "text-danger" : sendProgress === "sent" ? "text-brand" : "text-muted"}`}>{sendProgress === "waiting" ? "Waiting…" : sendProgress === "sending" ? "Sending…" : sendProgress === "sent" ? "Sent" : "Failed"}</p> : invoice.status === "draft" || invoice.status === "review" ? <button type="button" disabled={invoiceActionPending} onClick={() => setInvoiceSelection([invoice.id])} className="mt-2 text-xs text-brand disabled:opacity-40">Select to lock</button> : invoice.status === "locked" ? <button type="button" disabled={invoiceActionPending} onClick={() => startInvoiceAction(async () => { const result = await sendInvoices([invoice]); setInvoiceMessage(result.message); })} className="mt-2 text-xs text-brand disabled:opacity-40">Send approval</button> : null}</div>
                </div>;
              })}</div>
              {selectedToLock.length ? <div className="mt-3"><p className="mb-2 text-xs text-muted">Lock {selectedToLock.length} selected invoice{selectedToLock.length === 1 ? "" : "s"} totaling {new Intl.NumberFormat("en-US", { style: "currency", currency: selectedToLock[0].currency }).format(selectedToLock.reduce((sum, invoice) => sum + invoice.amountDueCents, 0) / 100)}.</p><HoldToConfirm compact action={() => lockInvoices(selectedToLock)} idleLabel="Hold to bulk lock selected invoices" holdingLabel="Keep holding to freeze these totals…" /></div> : null}
              {selectedToSend.length ? <div className="mt-3"><p className="mb-2 text-xs text-muted">Send {selectedToSend.length} separate payer approval email{selectedToSend.length === 1 ? "" : "s"}.</p><HoldToConfirm compact action={() => sendInvoices(selectedToSend)} idleLabel="Hold to send selected approvals" holdingLabel="Keep holding to send these emails…" /></div> : null}
              {invoiceMessage ? <p role="status" className="mt-3 border-l-2 border-brand pl-3 text-xs leading-5">{invoiceMessage}</p> : null}
            </> : <p className="py-5 text-sm text-muted">No invoices have been prepared.</p>}
            <Link href={`${base}/invoices`} onClick={() => setInvoicesOpen(false)} className="mt-3 block border-t border-line pt-3 text-xs text-brand">View all invoices →</Link>
          </div> : null}
        </div> : null}
        {can("school.approvals.review") ? <div ref={approvalsRef} className="relative z-30 flex flex-col items-end">
          <button type="button" aria-expanded={approvalsOpen} onClick={() => setApprovalsOpen((value) => { if (!value) window.dispatchEvent(new Event("common-time:open-approvals")); return !value; })} className="inline-flex items-center rounded-control border border-brand/40 bg-brand/10 px-3 py-1.5 text-sm text-brand transition hover:border-brand hover:bg-brand/15"><MdApproval aria-hidden="true" className="mr-1.5 text-base" />Approvals{approvalCount ? <span className="ml-2 inline-grid min-w-5 place-items-center rounded-full bg-brand px-1 text-xs text-canvas" aria-label={`${approvalCount} pending approvals`}>{approvalCount}</span> : null}</button>
          <Link href={`${base}/approvals`} aria-current={pathname.startsWith(`${base}/approvals`) ? "page" : undefined} className="mt-0.5 text-[10px] leading-none text-muted hover:text-ink">View all</Link>
          {approvalsOpen ? <div className="ui-card absolute top-full right-0 mt-2 w-[min(24rem,calc(100vw-2.5rem))] p-4"><div className="flex items-center justify-between"><p className="font-display text-2xl">Approvals</p><button type="button" onClick={() => setApprovalsOpen(false)} className="text-sm text-muted hover:text-ink">Close</button></div><div className="mt-3 flex rounded-control bg-surface p-1 text-xs"><button type="button" onClick={() => setApprovalView("pending")} className={`flex-1 rounded-control px-3 py-2 ${approvalView === "pending" ? "bg-surface-raised text-ink shadow-sm" : "text-muted hover:text-ink"}`}>Needs decision{approvalCount ? ` (${approvalCount})` : ""}</button><button type="button" onClick={() => setApprovalView("finished")} className={`flex-1 rounded-control px-3 py-2 ${approvalView === "finished" ? "bg-surface-raised text-ink shadow-sm" : "text-muted hover:text-ink"}`}>Finished</button></div><div className="mt-3">{visibleApprovals.length ? visibleApprovals.map((item) => <article key={`${item.kind}-${item.id}`} className="rounded-control px-3 py-3 hover:bg-brand/10"><div className="flex items-start justify-between gap-3"><p className="text-sm"><Link href={`${base}/staff/${item.teacherId}`} onClick={() => setApprovalsOpen(false)} className="hover:text-brand">{item.teacher}</Link> → <Link href={`${base}/students/${item.studentId}`} onClick={() => setApprovalsOpen(false)} className="hover:text-brand">{item.student}</Link></p>{approvalView === "finished" ? <span className="rounded-full bg-ink/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">{item.status}</span> : null}</div><Link href={`${base}/approvals?${approvalView === "finished" ? "view=history&" : ""}${item.kind === "schedule_proposal" ? "proposal" : "request"}=${item.id}`} onClick={() => setApprovalsOpen(false)} className="mt-1 block text-xs text-muted hover:text-brand">{item.detail} →</Link></article>) : <p className="py-5 text-sm text-muted">{approvalView === "pending" ? "No approvals need a decision." : "No finished approvals yet."}</p>}</div></div> : null}
        </div> : null}
        <OwnerNotifications schoolId={schoolId} embedded />
      </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 pl-1">
        {can("school.lessons.manage") && lessonCreationOptions ? <HeaderLessonFinder schoolId={schoolId} timeZone={timeZone} options={lessonCreationOptions} studentIdsByFamily={studentIdsByFamily} /> : null}
        {can("school.billing.manage") ? <PrepareInvoiceLauncher schoolId={schoolId} payers={invoicePayers} variant="nav" /> : null}
      </div>
    </nav>
  );
}
