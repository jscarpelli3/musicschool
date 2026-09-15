"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { OwnerNotifications } from "@/components/notifications/owner-notifications";

type RecentApproval = { id: string; kind: "schedule_proposal" | "lesson_change_request"; teacher: string; student: string; detail: string };

export function SchoolManagementNav({ schoolId, capabilities, approvalCount = 0, recentApprovals = [] }: { schoolId: string; capabilities: string[]; approvalCount?: number; recentApprovals?: RecentApproval[] }) {
  const pathname = usePathname();
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  useEffect(() => {
    const close = () => setApprovalsOpen(false);
    window.addEventListener("common-time:open-notifications", close);
    return () => window.removeEventListener("common-time:open-notifications", close);
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
      {can("school.setup.manage") ? <Link href={`${base}/setup`} className="text-sm text-brand hover:text-brand-hover">School setup →</Link> : null}
      <div className="ml-auto flex items-start gap-4">
        {can("school.approvals.review") ? <div className="relative z-[91] flex flex-col items-center">
          <button type="button" aria-expanded={approvalsOpen} onClick={() => setApprovalsOpen((value) => { if (!value) window.dispatchEvent(new Event("common-time:open-approvals")); return !value; })} className={`rounded-control px-3 py-1.5 text-sm transition ${approvalCount ? "bg-brand text-canvas" : "text-brand hover:bg-surface"}`}>Approvals{approvalCount ? <span className="ml-2 inline-grid min-w-5 place-items-center rounded-full border border-canvas/50 px-1 text-xs" aria-label={`${approvalCount} pending approvals`}>{approvalCount}</span> : null}</button>
          <Link href={`${base}/approvals`} aria-current={pathname.startsWith(`${base}/approvals`) ? "page" : undefined} className="mt-1 text-xs text-muted hover:text-ink">View all</Link>
          {approvalsOpen ? <div className="ui-card absolute top-full right-0 mt-2 w-[min(24rem,calc(100vw-2.5rem))] p-4"><div className="flex items-center justify-between"><p className="font-display text-2xl">Approvals</p><button type="button" onClick={() => setApprovalsOpen(false)} className="text-sm text-muted hover:text-ink">Close</button></div><div className="mt-3">{recentApprovals.length ? recentApprovals.map((item) => <Link key={`${item.kind}-${item.id}`} href={`${base}/approvals?${item.kind === "schedule_proposal" ? "proposal" : "request"}=${item.id}`} onClick={() => setApprovalsOpen(false)} className="block rounded-control px-3 py-3 transition hover:bg-brand/10"><p className="text-sm">{item.teacher} → {item.student}</p><p className="mt-1 text-xs text-muted">{item.detail}</p></Link>) : <p className="py-5 text-sm text-muted">No approvals need a decision.</p>}</div></div> : null}
        </div> : null}
        <OwnerNotifications schoolId={schoolId} embedded />
      </div>
    </nav>
  );
}
