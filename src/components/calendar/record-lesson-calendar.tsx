"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange } from "./calendar-range";
import { LessonCreationDialog, type LessonCreationOptions } from "@/components/scheduling/lesson-creation-dialog";
import { MdAddCircleOutline } from "react-icons/md";

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

export function RecordLessonCalendar({ schoolId, id, lessons, rangeStart, rangeEnd, timeZone, lessonCreationOptions, title, description }: {
  schoolId: string;
  id: string;
  lessons: RecordLessonCalendarItem[];
  rangeStart: Date;
  rangeEnd: Date;
  timeZone: string;
  lessonCreationOptions?: LessonCreationOptions;
  title: string;
  description: string;
}) {
  const [selectedLesson, setSelectedLesson] = useState<RecordLessonCalendarItem | null>(null);
  const [creationSlot, setCreationSlot] = useState<{ dateKey: string; time: string; teacherId: string; productId?: string } | null>(null);
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

  return <><section className="ui-card mt-6 p-6 md:p-8"><div className="mb-7 flex flex-wrap items-end justify-between gap-5"><div><h2 className="font-display text-3xl">{title}</h2><p className="mt-3 text-sm leading-6 text-muted">{description}</p></div>{lessonCreationOptions ? <button type="button" onClick={() => setCreationSlot({ dateKey: lessonCreationOptions.today, time: "", teacherId: "" })} className="inline-flex items-center gap-2 rounded-control border border-brand px-4 py-2.5 text-sm text-brand transition hover:bg-brand hover:text-canvas"><MdAddCircleOutline aria-hidden="true" className="text-lg" />Add without finding a time</button> : null}</div><CalendarRange
    id={id}
    items={lessons}
    rangeStart={rangeStart}
    rangeEnd={rangeEnd}
    timeZone={timeZone}
    getItemDate={(lesson) => new Date(lesson.startsAt)}
    getItemKey={(lesson) => lesson.id}
    emptyMonthLabel="No lessons this month"
    onSelectDate={lessonCreationOptions ? (dateKey) => setCreationSlot({ dateKey, time: "", teacherId: "" }) : undefined}
    renderItem={(lesson, { view }) => <button type="button" onClick={(event) => openLesson(lesson, event.currentTarget)} aria-label={`Open ${lesson.studentName}'s ${lesson.productName} lesson`} className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">{view === "agenda" ? <article className="rounded-control bg-surface px-4 py-3 transition hover:bg-surface/70">
      <p className="text-sm"><span className="text-brand">{time.format(new Date(lesson.startsAt))}</span> · {lesson.studentName}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{lesson.productName} with {lesson.teacherName}</p>
      <p className="text-xs leading-5 text-muted">{lesson.placeName} · {lesson.status.replaceAll("_", " ")}</p>
    </article> : <article className="rounded-control bg-surface px-2 py-2 transition hover:bg-surface/70">
      <p className="text-xs text-brand">{time.format(new Date(lesson.startsAt))}</p>
      <p className="mt-1 block truncate text-xs text-ink" title={lesson.studentName}>{lesson.studentName}</p>
      <p className="mt-1 block truncate text-xs text-muted" title={lesson.teacherName}>{lesson.teacherName}</p>
    </article>}</button>}
  /></section>
  {creationSlot && lessonCreationOptions ? <LessonCreationDialog schoolId={schoolId} slot={creationSlot} options={lessonCreationOptions} lockTeacher={false} timeZone={timeZone} onClose={() => setCreationSlot(null)} /> : null}
  {selectedLesson ? <div className="fixed inset-0 z-[80] flex justify-end">
    <button type="button" aria-label="Close lesson details" onClick={closeLesson} className="absolute inset-0 cursor-default bg-ink/70" />
    <aside role="dialog" aria-modal="true" aria-labelledby={`${id}-lesson-title`} className="relative z-10 h-full w-full overflow-y-auto border-l border-line bg-surface px-6 py-7 shadow-2xl sm:max-w-md sm:px-8">
      <header className="flex items-start justify-between gap-6 pb-6">
        <div><p className="text-xs text-brand">{selectedLesson.status.replaceAll("_", " ")}</p><h2 id={`${id}-lesson-title`} className="mt-3 font-display text-4xl">{selectedLesson.studentName}</h2></div>
        <button ref={closeButtonRef} type="button" onClick={closeLesson} className="min-h-11 px-2 text-sm text-muted hover:text-ink">Close</button>
      </header>
      <dl className="grid gap-1 rounded-card bg-surface-raised p-5 shadow-[var(--ui-shadow-soft)]">
        <div className="rounded-control bg-canvas/55 p-3"><dt className="text-xs text-muted">Date</dt><dd className="mt-2 text-sm">{date.format(new Date(selectedLesson.startsAt))}</dd></div>
        <div className="rounded-control p-3"><dt className="text-xs text-muted">Time</dt><dd className="mt-2 text-sm">{time.format(new Date(selectedLesson.startsAt))}–{time.format(new Date(selectedLesson.endsAt))}</dd></div>
        <div className="rounded-control bg-canvas/55 p-3"><dt className="text-xs text-muted">Teacher</dt><dd className="mt-2 text-sm">{selectedLesson.teacherName}</dd></div>
        <div className="rounded-control p-3"><dt className="text-xs text-muted">Place</dt><dd className="mt-2 text-sm">{selectedLesson.placeName}</dd></div>
        <div className="rounded-control bg-canvas/55 p-3"><dt className="text-xs text-muted">Lesson</dt><dd className="mt-2 text-sm">{selectedLesson.productName}</dd></div>
      </dl>
    </aside>
  </div> : null}</>;
}
