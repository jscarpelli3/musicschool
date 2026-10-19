"use client";

import { useRef, useState } from "react";
import { CalendarRange } from "./calendar-range";
import { LessonRequestControls } from "./lesson-request-controls";
import { LessonDrawerShell } from "@/components/ui/lesson-drawer-shell";

export type LessonCalendarItem = {
  lessonId: string;
  studentName: string;
  teacherName: string;
  productName: string;
  placeName: string;
  startsAt: string;
  endsAt: string;
  pendingRequest: { id: string; type: string; status: string; requestedAt: string } | null;
};

type LessonCalendarProps = {
  id: string;
  lessons: readonly LessonCalendarItem[];
  rangeStart: Date;
  rangeEnd: Date;
  timeZone: string;
  schoolContact: { name: string; phone: string | null; email: string | null };
};

export function LessonCalendar({ id, lessons, rangeStart, rangeEnd, timeZone, schoolContact }: LessonCalendarProps) {
  const [selectedLesson, setSelectedLesson] = useState<LessonCalendarItem | null>(null);
  const [submittedRequests, setSubmittedRequests] = useState<Record<string, NonNullable<LessonCalendarItem["pendingRequest"]>>>({});
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  const date = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "long", day: "numeric", year: "numeric" });

  function openLesson(lesson: LessonCalendarItem, opener: HTMLButtonElement) {
    window.dispatchEvent(new Event("common-time:open-lesson-drawer"));
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
  {selectedLesson ? <LessonDrawerShell titleId={`${id}-lesson-title`} eyebrow="Lesson details" title={selectedLesson.studentName} onClose={closeLesson} surface="canvas">
      <dl className="divide-y divide-line">
        <div className="py-5"><dt className="text-xs text-muted">Date</dt><dd className="mt-2 text-sm">{date.format(new Date(selectedLesson.startsAt))}</dd></div>
        <div className="py-5"><dt className="text-xs text-muted">Time</dt><dd className="mt-2 text-sm">{time.format(new Date(selectedLesson.startsAt))}–{time.format(new Date(selectedLesson.endsAt))}</dd></div>
        <div className="py-5"><dt className="text-xs text-muted">Lesson</dt><dd className="mt-2 text-sm">{selectedLesson.productName}</dd></div>
        <div className="py-5"><dt className="text-xs text-muted">Teacher</dt><dd className="mt-2 text-sm">{selectedLesson.teacherName}</dd></div>
        <div className="py-5"><dt className="text-xs text-muted">Place</dt><dd className="mt-2 text-sm">{selectedLesson.placeName}</dd></div>
      </dl>
      <LessonRequestControls lessonId={selectedLesson.lessonId} timeZone={timeZone} schoolContact={schoolContact} pendingRequest={submittedRequests[selectedLesson.lessonId]??selectedLesson.pendingRequest} onRequestSubmitted={(request)=>setSubmittedRequests((current)=>({...current,[selectedLesson.lessonId]:request}))} />
  </LessonDrawerShell> : null}</>;
}
