"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange } from "./calendar-range";
import { QuickActionGrid, type QuickAction } from "@/components/ui/quick-action-grid";

export type RecordLessonCalendarItem = {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  productName: string;
  placeName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  billingAccounts?: Array<{ id: string; name: string }>;
};

export function RecordLessonCalendar({ schoolId, id, lessons, rangeStart, rangeEnd, timeZone }: {
  schoolId: string;
  id: string;
  lessons: RecordLessonCalendarItem[];
  rangeStart: Date;
  rangeEnd: Date;
  timeZone: string;
}) {
  const [selectedLesson, setSelectedLesson] = useState<RecordLessonCalendarItem | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  const date = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "long", day: "numeric", year: "numeric" });

  useEffect(() => {
    if (!selectedLesson) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelectedLesson(null);
      requestAnimationFrame(() => openerRef.current?.focus());
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedLesson]);

  function openLesson(lesson: RecordLessonCalendarItem, opener: HTMLButtonElement) {
    window.dispatchEvent(new Event("common-time:open-lesson-drawer"));
    openerRef.current = opener;
    setSelectedLesson(lesson);
  }

  function closeLesson() {
    setSelectedLesson(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  }

  const quickActions: QuickAction[] = selectedLesson ? [
    { href: `/schools/${schoolId}?lesson=${selectedLesson.id}#school-calendar`, kind: "lesson", title: "Full lesson controls", detail: "Payments, changes, notes, and more." },
    ...(selectedLesson.billingAccounts ?? []).map((account) => ({ href: `/schools/${schoolId}/families/${account.id}#billing-history`, kind: "billing" as const, title: `${account.name} billing`, detail: "Jump straight to invoices and payment history." })),
    { href: `/schools/${schoolId}/students/${selectedLesson.studentId}`, kind: "student", title: "Student home", detail: "Contacts, schedule, and lesson plan." },
    { href: `/schools/${schoolId}/staff/${selectedLesson.teacherId}`, kind: "teacher", title: "Teacher home", detail: "Schedule, availability, and details." },
  ] : [];

  return <><CalendarRange
    id={id}
    items={lessons}
    rangeStart={rangeStart}
    rangeEnd={rangeEnd}
    timeZone={timeZone}
    getItemDate={(lesson) => new Date(lesson.startsAt)}
    getItemKey={(lesson) => lesson.id}
    emptyMonthLabel="No lessons this month"
    renderItem={(lesson, { view }) => <button type="button" onClick={(event) => openLesson(lesson, event.currentTarget)} aria-label={`Open ${lesson.studentName}'s ${lesson.productName} lesson`} className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">{view === "agenda" ? <article className="rounded-control bg-surface px-4 py-3 transition hover:bg-surface/70">
      <p className="text-sm"><span className="text-brand">{time.format(new Date(lesson.startsAt))}</span> · {lesson.studentName}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{lesson.productName} with {lesson.teacherName}</p>
      <p className="text-xs leading-5 text-muted">{lesson.placeName} · {lesson.status.replaceAll("_", " ")}</p>
    </article> : <article className="rounded-control bg-surface px-2 py-2 transition hover:bg-surface/70">
      <p className="text-xs text-brand">{time.format(new Date(lesson.startsAt))}</p>
      <p className="mt-1 block truncate text-xs text-ink" title={lesson.studentName}>{lesson.studentName}</p>
      <p className="mt-1 block truncate text-xs text-muted" title={lesson.teacherName}>{lesson.teacherName}</p>
    </article>}</button>}
  />
  {selectedLesson ? <div className="fixed inset-0 z-[80] flex justify-end">
    <button type="button" aria-label="Close lesson details" onClick={closeLesson} className="absolute inset-0 cursor-default bg-ink/70" />
    <aside role="dialog" aria-modal="true" aria-labelledby={`${id}-lesson-title`} className="relative z-10 h-full w-full overflow-y-auto border-l border-line bg-canvas px-6 py-7 shadow-2xl sm:max-w-md sm:px-8">
      <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
        <div><p className="text-xs text-brand">{selectedLesson.status.replaceAll("_", " ")}</p><h2 id={`${id}-lesson-title`} className="mt-3 font-display text-4xl">{selectedLesson.studentName}</h2></div>
        <button ref={closeButtonRef} type="button" onClick={closeLesson} className="min-h-11 px-2 text-sm text-muted hover:text-ink">Close</button>
      </header>
      <div className="border-b border-line"><QuickActionGrid actions={quickActions} /></div>
      <dl className="divide-y divide-line border-b border-line">
        <div className="py-5"><dt className="text-xs text-muted">Date</dt><dd className="mt-2 text-sm">{date.format(new Date(selectedLesson.startsAt))}</dd></div>
        <div className="py-5"><dt className="text-xs text-muted">Time</dt><dd className="mt-2 text-sm">{time.format(new Date(selectedLesson.startsAt))}–{time.format(new Date(selectedLesson.endsAt))}</dd></div>
        <div className="py-5"><dt className="text-xs text-muted">Lesson</dt><dd className="mt-2 text-sm">{selectedLesson.productName}</dd></div>
        <div className="py-5"><dt className="text-xs text-muted">Teacher</dt><dd className="mt-2 text-sm">{selectedLesson.teacherName}</dd></div>
        <div className="py-5"><dt className="text-xs text-muted">Place</dt><dd className="mt-2 text-sm">{selectedLesson.placeName}</dd></div>
      </dl>
    </aside>
  </div> : null}</>;
}
