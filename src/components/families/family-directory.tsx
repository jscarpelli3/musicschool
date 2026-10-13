"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MdReceiptLong, MdSearch } from "react-icons/md";
import { DirectoryLessonFinder } from "@/components/scheduling/directory-lesson-finder";
import type { LessonCreationOptions } from "@/components/scheduling/lesson-creation-dialog";

export type FamilyDirectoryRow = {
  id: string;
  schoolId: string;
  name: string;
  status: string;
  contactName: string;
  contactDetail: string;
  studentCount: number;
  invoice: null | {
    statusLabel: string;
    label: string;
    amountDue: string;
  };
};

export function FamilyDirectory({ rows, schoolId, timeZone, lessonCreationOptions }: { rows: FamilyDirectoryRow[]; schoolId: string; timeZone: string; lessonCreationOptions?: LessonCreationOptions }) {
  const [search, setSearch] = useState("");
  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return rows;
    return rows.filter((row) => [row.name, row.contactName, row.contactDetail]
      .some((value) => value.toLocaleLowerCase().includes(query)));
  }, [rows, search]);

  return <>
    {lessonCreationOptions ? <DirectoryLessonFinder schoolId={schoolId} timeZone={timeZone} options={lessonCreationOptions} /> : null}
    <label className="mt-8 block max-w-xl text-xs font-medium uppercase tracking-[0.14em] text-muted">
      Search families
      <span className="mt-2 flex items-center gap-2 rounded-control border border-line bg-surface px-3 focus-within:border-brand">
        <MdSearch aria-hidden="true" className="shrink-0 text-lg" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Family, payer, email, or phone" className="min-w-0 flex-1 bg-transparent py-3 text-sm normal-case tracking-normal text-foreground outline-none placeholder:text-muted" />
      </span>
    </label>
    <div className="mt-8 grid gap-4">
      {filteredRows.map((row) => <Link key={row.id} href={`/schools/${row.schoolId}/families/${row.id}`} className="ui-card grid gap-4 border border-transparent p-5 transition hover:-translate-y-px hover:border-brand/50 hover:bg-surface sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:items-center sm:p-6"><div><h2 className="font-display text-2xl">{row.name}</h2><p className="mt-1 text-xs capitalize text-muted">{row.status}</p>{row.invoice ? <span className="mt-4 inline-flex items-center gap-2 rounded-control border border-brand/40 bg-brand/10 px-3 py-2 text-xs text-brand"><MdReceiptLong aria-hidden="true" className="shrink-0 text-lg" /><span><strong className="font-medium">{row.invoice.statusLabel} invoice</strong><span className="ml-1 text-muted">· {row.invoice.label} · {row.invoice.amountDue} due</span></span></span> : null}</div><div className="text-sm text-muted"><p>{row.contactName}</p><p className="mt-1 text-xs">{row.contactDetail}</p></div><p className="text-sm text-brand">{row.studentCount} {row.studentCount === 1 ? "student" : "students"} →</p></Link>)}
      {!rows.length ? <p className="ui-card p-6 text-sm text-muted">No family accounts have been created.</p> : null}
      {rows.length && !filteredRows.length ? <p className="ui-card p-6 text-sm text-muted">No families match “{search.trim()}”.</p> : null}
    </div>
  </>;
}
