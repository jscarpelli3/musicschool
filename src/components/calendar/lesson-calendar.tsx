"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange } from "./calendar-range";

export type LessonCalendarItem = {
  lessonId: string;
  studentName: string;
  teacherName: string;
  productName: string;
  placeName: string;
  startsAt: string;
  endsAt: string;
};

type LessonCalendarProps = {
  id: string;
  lessons: readonly LessonCalendarItem[];
  rangeStart: Date;
  rangeEnd: Date;
  timeZone: string;
};

export function LessonCalendar({ id, lessons, rangeStart, rangeEnd, timeZone }: LessonCalendarProps) {
  const [selectedLesson, setSelectedLesson] = useState<LessonCalendarItem | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  const date = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "long", day: "numeric", year: "numeric" });

  useEffect(() => {
    if (!selectedLesson) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedLesson(null);
        requestAnimationFrame(() => openerRef.current?.focus());
      }
      if (event.key === "Tab") {
        const controls = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedLesson]);

  function openLesson(lesson: LessonCalendarItem, opener: HTMLButtonElement) {
    openerRef.current = opener;
    setSelectedLesson(lesson);
  }

  function closeLesson() {
    setSelectedLesson(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  }

  return <><CalendarRange
    id={id}
    items={lessons}
    rangeStart={rangeStart}
    rangeEnd={rangeEnd}
    timeZone={timeZone}
    getItemDate={(lesson) => new Date(lesson.startsAt)}
    getItemKey={(lesson) => lesson.lessonId}
    emptyMonthLabel="No lessons this month"
    renderItem={(lesson, { view }) => <button type="button" onClick={(event) => openLesson(lesson, event.currentTarget)} aria-label={`Open ${lesson.studentName}'s ${lesson.productName} lesson`} className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">{view === "agenda"
      ? <article className="border-l-2 border-brand pl-4 transition-colors hover:border-ink">
          <p className="text-sm"><span className="text-brand">{time.format(new Date(lesson.startsAt))}</span> · {lesson.studentName}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{lesson.productName} with {lesson.teacherName}</p>
          <p className="text-xs leading-5 text-muted">{lesson.placeName} · until {time.format(new Date(lesson.endsAt))}</p>
        </article>
      : <article className="border-l-2 border-brand bg-surface px-2 py-2 transition-colors hover:border-ink hover:bg-surface/70">
          <p className="text-xs text-brand">{time.format(new Date(lesson.startsAt))}</p>
          <p className="mt-1 truncate text-xs text-ink" title={lesson.studentName}>{lesson.studentName}</p>
          <p className="mt-1 truncate text-xs text-muted" title={`${lesson.productName} with ${lesson.teacherName}`}>{lesson.productName}</p>
        </article>}</button>}
  />
  {selectedLesson ? <div className="fixed inset-0 z-50 flex justify-end">
    <button type="button" aria-label="Close lesson details" onClick={closeLesson} className="absolute inset-0 cursor-default bg-ink/70" />
    <aside ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-lesson-title`} className="relative z-10 h-full w-full overflow-y-auto border-l border-line bg-canvas px-6 py-7 shadow-2xl sm:max-w-md sm:px-8">
      <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
        <div><p className="text-xs text-brand">Lesson details</p><h2 id={`${id}-lesson-title`} className="mt-3 font-display text-4xl">{selectedLesson.studentName}</h2></div>
        <button ref={closeButtonRef} type="button" onClick={closeLesson} className="min-h-11 px-2 text-sm text-muted hover:text-ink">Close</button>
      </header>
      <dl className="divide-y divide-line">
        <div className="py-5"><dt className="text-xs text-muted">Date</dt><dd className="mt-2 text-sm">{date.format(new Date(selectedLesson.startsAt))}</dd></div>
        <div className="py-5"><dt className="text-xs text-muted">Time</dt><dd className="mt-2 text-sm">{time.format(new Date(selectedLesson.startsAt))}–{time.format(new Date(selectedLesson.endsAt))}</dd></div>
        <div className="py-5"><dt className="text-xs text-muted">Lesson</dt><dd className="mt-2 text-sm">{selectedLesson.productName}</dd></div>
        <div className="py-5"><dt className="text-xs text-muted">Teacher</dt><dd className="mt-2 text-sm">{selectedLesson.teacherName}</dd></div>
        <div className="py-5"><dt className="text-xs text-muted">Place</dt><dd className="mt-2 text-sm">{selectedLesson.placeName}</dd></div>
      </dl>
    </aside>
  </div> : null}</>;
}
