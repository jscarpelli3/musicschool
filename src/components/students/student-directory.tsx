import Link from "next/link";
import { AddFamilyDialog } from "@/components/families/add-family-dialog";
import type { AddFamilyState } from "@/app/schools/[schoolId]/families/actions";
import type { StudentRosterRow } from "./student-roster-table";
import { LessonStatusStrip } from "./lesson-status-strip";

export function StudentDirectory({ rows, monthLabel, addFamilyAction }: {
  rows: StudentRosterRow[];
  monthLabel: string;
  addFamilyAction?: (state: AddFamilyState, formData: FormData) => Promise<AddFamilyState>;
}) {
  return <section aria-labelledby="student-directory-heading">
    <header className="flex flex-wrap items-end justify-between gap-6 pb-4">
      <div><h1 id="student-directory-heading" className="font-display text-5xl tracking-[-0.04em] sm:text-6xl">Students.</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-muted">Open a student record to see their family, lesson calendar, teachers, and recent activity.</p><p className="mt-2 text-sm text-muted">{rows.length} students</p></div>
      {addFamilyAction ? <AddFamilyDialog action={addFamilyAction} triggerLabel="Add student +" /> : null}
    </header>
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {rows.map((row) => <article key={row.id} className="ui-card p-5 transition hover:-translate-y-px hover:bg-surface sm:p-6">
        <div className="flex items-start justify-between gap-5"><div><h2 className="font-display text-2xl"><Link href={`/schools/${row.schoolId}/students/${row.id}`} className="hover:text-brand">{row.student}</Link></h2><p className="mt-2 text-sm text-muted">{row.billingAccountId ? <Link href={`/schools/${row.schoolId}/families/${row.billingAccountId}`} className="hover:text-brand">{row.family}</Link> : row.family}</p></div><Link href={`/schools/${row.schoolId}/students/${row.id}`} aria-label={`Open ${row.student}`} className="text-brand">→</Link></div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div className="rounded-control bg-surface p-3"><dt className="text-xs text-muted">Regular time</dt><dd className="mt-1">{row.day === "—" ? "Not scheduled" : `${row.day} · ${row.time}`}</dd></div><div className="rounded-control bg-surface p-3"><dt className="text-xs text-muted">Teacher</dt><dd className="mt-1">{row.teacherId ? <Link href={`/schools/${row.schoolId}/staff/${row.teacherId}`} className="hover:text-brand">{row.teacher}</Link> : row.teacher}</dd></div></dl>
        <div className="mt-5"><LessonStatusStrip schoolId={row.schoolId} lessons={row.lessons} monthLabel={monthLabel} /></div>
      </article>)}
      {!rows.length ? <p className="ui-card p-6 text-sm text-muted sm:col-span-2">No student records have been created.</p> : null}
    </div>
  </section>;
}
