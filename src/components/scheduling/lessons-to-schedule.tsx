import Link from "next/link";
import type { ServiceEntitlementItem } from "@/lib/scheduling/service-entitlements";

export function LessonsToSchedule({ schoolId, items, timezone, compact = false }: {
  schoolId: string; items: ServiceEntitlementItem[]; timezone: string; compact?: boolean;
}) {
  if (!items.length) return null;
  const date = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long", month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  return <div className="divide-y divide-line border-y border-line">
    {items.map((item) => <article key={item.id} className={`grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center ${compact ? "text-sm" : ""}`}>
      <div><p className="font-medium">{item.studentName} · {item.productName}</p>
        <p className="mt-1 text-sm text-muted">{item.durationMinutes} minutes · from {date(item.sourceStartsAt)}{item.teacherName ? ` · ${item.teacherName}` : " · any teacher"}</p>
        {item.expiresAt ? <p className="mt-1 text-xs text-muted">Schedule by {date(item.expiresAt)}</p> : null}
      </div>
      <Link href={`/schools/${schoolId}/lessons/new?entitlement=${item.id}${item.teacherId ? `&teacher=${item.teacherId}` : ""}`} className="border-b border-brand pb-1 text-sm text-brand hover:text-brand-hover">Schedule lesson →</Link>
    </article>)}
  </div>;
}
