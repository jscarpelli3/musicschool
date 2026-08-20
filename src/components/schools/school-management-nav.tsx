"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OwnerNotifications } from "@/components/notifications/owner-notifications";

export function SchoolManagementNav({ schoolId, role }: { schoolId: string; role: string }) {
  const pathname = usePathname();
  const base = `/schools/${schoolId}`;
  const items = [
    { label: "Dashboard", href: base, active: pathname === base },
    { label: "Students", href: `${base}/students`, active: pathname.startsWith(`${base}/students`) },
    { label: "Families", href: `${base}/families`, active: pathname.startsWith(`${base}/families`) },
    ...(role === "owner" ? [{ label: "Staff", href: `${base}/staff`, active: pathname.startsWith(`${base}/staff`) }] : []),
  ];
  const canManage = role === "owner" || role === "admin";

  return (
    <nav className="flex flex-wrap items-center gap-x-6 gap-y-4 border-b border-line py-5" aria-label="School management">
      {items.map((item) => <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} className={`relative py-1 text-sm transition-colors after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:bg-brand ${item.active ? "text-ink after:scale-x-100" : "text-muted after:scale-x-0 hover:text-ink"}`}>{item.label}</Link>)}
      {canManage ? <Link href={`${base}/lessons/new`} className="text-sm text-brand hover:text-brand-hover">New lesson +</Link> : null}
      {canManage ? <Link href={`${base}/setup`} className="text-sm text-brand hover:text-brand-hover">School setup →</Link> : null}
      <div className="ml-auto"><OwnerNotifications schoolId={schoolId} embedded /></div>
    </nav>
  );
}
