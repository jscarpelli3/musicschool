"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function sectionForPath(pathname: string, schoolId: string) {
  const base = `/schools/${schoolId}`;
  const relative = pathname.slice(base.length);

  if (!relative || relative === "/") return "dashboard";
  if (relative.startsWith("/students")) return "students";
  if (relative.startsWith("/families")) return "families";
  if (relative.startsWith("/staff") || relative.startsWith("/teacher")) return "staff";
  if (relative.startsWith("/invoices") || relative.startsWith("/payments")) return "billing";
  if (relative.startsWith("/approvals") || relative.startsWith("/notifications")) return "approvals";
  return "settings";
}

export function SchoolSectionFrame({ schoolId, children }: { schoolId: string; children: ReactNode }) {
  const pathname = usePathname();
  return <div data-school-section={sectionForPath(pathname, schoolId)} className="min-h-screen">{children}</div>;
}
