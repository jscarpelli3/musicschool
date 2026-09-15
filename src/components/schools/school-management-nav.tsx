"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { OwnerNotifications } from "@/components/notifications/owner-notifications";
import type { SchoolInvoice } from "@/lib/billing/school-invoices";

type RecentApproval = { id: string; kind: "schedule_proposal" | "lesson_change_request"; teacherId: string; studentId: string; teacher: string; student: string; detail: string };

export function SchoolManagementNav({ schoolId, capabilities, approvalCount = 0, recentApprovals = [], invoiceCount = 0, recentInvoices = [] }: { schoolId: string; capabilities: string[]; approvalCount?: number; recentApprovals?: RecentApproval[]; invoiceCount?: number; recentInvoices?: SchoolInvoice[] }) {
  const pathname = usePathname();
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  useEffect(() => {
    const close = () => setApprovalsOpen(false);
    window.addEventListener("common-time:open-notifications", close);
    window.addEventListener("common-time:open-invoices", close);
    return () => { window.removeEventListener("common-time:open-notifications", close); window.removeEventListener("common-time:open-invoices", close); };
  }, []);
  useEffect(() => {
    const close = () => setInvoicesOpen(false);
    window.addEventListener("common-time:open-notifications", close);
    window.addEventListener("common-time:open-approvals", close);
    return () => { window.removeEventListener("common-time:open-notifications", close); window.removeEventListener("common-time:open-approvals", close); };
  }, []);
  const base = `/schools/${schoolId}`;
  const can = (capability: string) => capabilities.includes(capability);
  const dashboardHref = can("school.workspace.view") ? base : `${base}/teacher`;
  const items = !can("school.workspace.view")
    ? [{ label: "My schedule", href: dashboardHref, active: pathname.startsWith(dashboardHref) }]
    : [
        { label: "Dashboard", href: dashboardHref, active: pathname === dashboardHref },
        { label: "Students", href: `${base}/students`, active: pathname.startsWith(`${base}/students`) },
        { label: "Families", href: `${base}/families`, active: pathname.startsWith(`${base}/families`) },
        ...(can("school.staff.directory_manage") ? [{ label: "Staff", href: `${base}/staff`, active: pathname.startsWith(`${base}/staff`) }] : []),
      ];

  return (
    <nav className="flex flex-wrap items-center gap-x-6 gap-y-4 border-b border-line py-5" aria-label="School management">
      {items.map((item) => <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} className={`relative py-1 text-sm transition-colors after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:bg-brand ${item.active ? "text-ink after:scale-x-100" : "text-muted after:scale-x-0 hover:text-ink"}`}>{item.label}</Link>)}
      {can("school.lessons.manage") ? <Link href={`${base}/lessons/new`} className="text-sm text-brand hover:text-brand-hover">New lesson +</Link> : null}
      <div className="ml-auto flex flex-wrap items-start justify-end gap-3 sm:gap-4">
        {can("school.billing.manage") ? <div className="relative z-[91] flex flex-col items-end">
          <button type="button" aria-expanded={invoicesOpen} onClick={() => setInvoicesOpen((value) => { if (!value) window.dispatchEvent(new Event("common-time:open-invoices")); return !value; })} className="rounded-control border border-brand/40 bg-brand/10 px-3 py-1.5 text-sm text-brand transition hover:border-brand hover:bg-brand/15">Invoices{invoiceCount ? <span className="ml-2 inline-grid min-w-5 place-items-center rounded-full bg-brand px-1 text-xs text-canvas" aria-label={`${invoiceCount} open invoices`}>{invoiceCount}</span> : null}</button>
          <Link href={`${base}/invoices`} aria-current={pathname.startsWith(`${base}/invoices`) ? "page" : undefined} className="mt-0.5 text-[10px] leading-none text-muted hover:text-ink">View all</Link>
          {invoicesOpen ? <div className="ui-card absolute top-full right-0 mt-2 w-[min(24rem,calc(100vw-2.5rem))] p-4"><div className="flex items-center justify-between"><p className="font-display text-2xl">Invoices</p><button type="button" onClick={() => setInvoicesOpen(false)} className="text-sm text-muted hover:text-ink">Close</button></div><div className="mt-3">{recentInvoices.length ? recentInvoices.map((invoice) => <Link key={invoice.id} href={`${base}/families/${invoice.billingAccountId}?period=${invoice.id}`} onClick={() => setInvoicesOpen(false)} className="block rounded-control px-3 py-3 transition hover:bg-brand/10"><div className="flex justify-between gap-4"><p className="text-sm">{invoice.familyName}</p><p className="text-sm">{new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency }).format(invoice.amountDueCents / 100)}</p></div><p className="mt-1 text-xs text-muted">{invoice.label} · {invoice.statusLabel}</p></Link>) : <p className="py-5 text-sm text-muted">No invoices have been prepared.</p>}</div></div> : null}
        </div> : null}
        {can("school.approvals.review") ? <div className="relative z-[91] flex flex-col items-end">
          <button type="button" aria-expanded={approvalsOpen} onClick={() => setApprovalsOpen((value) => { if (!value) window.dispatchEvent(new Event("common-time:open-approvals")); return !value; })} className="rounded-control border border-brand/40 bg-brand/10 px-3 py-1.5 text-sm text-brand transition hover:border-brand hover:bg-brand/15">Approvals{approvalCount ? <span className="ml-2 inline-grid min-w-5 place-items-center rounded-full bg-brand px-1 text-xs text-canvas" aria-label={`${approvalCount} pending approvals`}>{approvalCount}</span> : null}</button>
          <Link href={`${base}/approvals`} aria-current={pathname.startsWith(`${base}/approvals`) ? "page" : undefined} className="mt-0.5 text-[10px] leading-none text-muted hover:text-ink">View all</Link>
          {approvalsOpen ? <div className="ui-card absolute top-full right-0 mt-2 w-[min(24rem,calc(100vw-2.5rem))] p-4"><div className="flex items-center justify-between"><p className="font-display text-2xl">Approvals</p><button type="button" onClick={() => setApprovalsOpen(false)} className="text-sm text-muted hover:text-ink">Close</button></div><div className="mt-3">{recentApprovals.length ? recentApprovals.map((item) => <article key={`${item.kind}-${item.id}`} className="rounded-control px-3 py-3 hover:bg-brand/10"><p className="text-sm"><Link href={`${base}/staff/${item.teacherId}`} onClick={() => setApprovalsOpen(false)} className="hover:text-brand">{item.teacher}</Link> → <Link href={`${base}/students/${item.studentId}`} onClick={() => setApprovalsOpen(false)} className="hover:text-brand">{item.student}</Link></p><Link href={`${base}/approvals?${item.kind === "schedule_proposal" ? "proposal" : "request"}=${item.id}`} onClick={() => setApprovalsOpen(false)} className="mt-1 block text-xs text-muted hover:text-brand">{item.detail} →</Link></article>) : <p className="py-5 text-sm text-muted">No approvals need a decision.</p>}</div></div> : null}
        </div> : null}
        <OwnerNotifications schoolId={schoolId} embedded />
      </div>
    </nav>
  );
}
