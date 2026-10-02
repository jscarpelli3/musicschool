import Link from "next/link";
import { AddFamilyDialog } from "@/components/families/add-family-dialog";
import type { AddFamilyState } from "@/app/schools/[schoolId]/families/actions";
import type { StudentRosterRow } from "./student-roster-table";
import { LessonStatusStrip } from "./lesson-status-strip";
import { MdPersonOutline, MdSchedule } from "react-icons/md";

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
      {rows.map((row) => <article key={row.id} className="ui-card relative overflow-hidden border border-line p-5 transition hover:-translate-y-px hover:border-brand/60 sm:p-6">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand" />
        <div className="flex items-start justify-between gap-5"><div className="flex min-w-0 items-start gap-3"><span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/10 text-xl text-brand"><MdPersonOutline /></span><div><h2 className="font-display text-2xl"><Link href={`/schools/${row.schoolId}/students/${row.id}`} className="hover:text-brand">{row.student}</Link></h2><p className="mt-1 text-sm text-muted">{row.billingAccountId ? <Link href={`/schools/${row.schoolId}/families/${row.billingAccountId}`} className="hover:text-brand">{row.family}</Link> : row.family}</p></div></div><Link href={`/schools/${row.schoolId}/students/${row.id}`} aria-label={`Open ${row.student}`} className="text-brand">→</Link></div>
        <dl className="mt-6 grid gap-x-6 gap-y-4 border-y border-line py-4 text-sm sm:grid-cols-2"><div><dt className="flex items-center gap-1.5 text-xs text-muted"><MdSchedule aria-hidden="true" />Regular time</dt><dd className="mt-1">{row.day === "—" ? "Not scheduled" : `${row.day} · ${row.time}`}</dd></div><div><dt className="text-xs text-muted">Teacher</dt><dd className="mt-1">{row.teacherId ? <Link href={`/schools/${row.schoolId}/staff/${row.teacherId}`} className="hover:text-brand">{row.teacher}</Link> : row.teacher}</dd></div></dl>
        <div className="mt-5"><p className="mb-2 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted">This month · {monthLabel}</p><LessonStatusStrip schoolId={row.schoolId} lessons={row.lessons} monthLabel={monthLabel} /></div>
      </article>)}
      {!rows.length ? <p className="ui-card p-6 text-sm text-muted sm:col-span-2">No student records have been created.</p> : null}
    </div>
  </section>;
}
