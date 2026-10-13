"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export type LessonOutcome = "completed" | "rescheduled" | "cancelled_timely" | "cancelled_late" | "no_show" | "upcoming" | "unrecorded";

export type LessonStatusItem = {
  id: string;
  outcome: LessonOutcome;
  dateLabel: string;
  timeLabel: string;
  teacherName: string;
  productName: string;
  placeName: string;
};

const outcomes: Record<LessonOutcome, { label: string; mark: string; action: string }> = {
  completed: { label: "Serviced", mark: "bg-brand", action: "Open lesson details" },
  rescheduled: { label: "Rescheduled", mark: "bg-outcome-rescheduled", action: "Open lesson details" },
  cancelled_timely: { label: "Cancelled in time", mark: "bg-outcome-cancelled", action: "Open cancellation details" },
  cancelled_late: { label: "Late cancellation", mark: "bg-danger", action: "Open cancellation details" },
  no_show: { label: "No-show", mark: "bg-outcome-no-show", action: "Open lesson details" },
  upcoming: { label: "Upcoming", mark: "border border-line bg-transparent", action: "Open to reschedule or manage" },
  unrecorded: { label: "Needs status", mark: "border border-danger bg-transparent", action: "Open to record what happened" },
};

export function LessonStatusStrip({ schoolId, lessons, monthLabel }: { schoolId: string; lessons: LessonStatusItem[]; monthLabel: string }) {
  const [tooltip, setTooltip] = useState<{ lessonId: string; left: number; top: number } | null>(null);
  const counts = lessons.reduce<Partial<Record<LessonOutcome, number>>>((total, lesson) => {
    total[lesson.outcome] = (total[lesson.outcome] ?? 0) + 1;
    return total;
  }, {});
  return <div>
    <div className="flex gap-1" aria-label={`${lessons.length} lessons in ${monthLabel}`}>
      {lessons.map((lesson) => {
        const outcome = outcomes[lesson.outcome];
        const showTooltip = (element: HTMLElement) => { const bounds = element.getBoundingClientRect(); setTooltip({ lessonId: lesson.id, left: Math.min(window.innerWidth - 136, Math.max(136, bounds.left + bounds.width / 2)), top: bounds.top - 8 }); };
        return <span key={lesson.id} className="min-w-4 flex-1">
          <Link href={`/schools/${schoolId}?lesson=${lesson.id}#school-calendar`} aria-label={`${outcome.label}, ${lesson.dateLabel}, ${lesson.timeLabel}, ${lesson.productName} with ${lesson.teacherName} at ${lesson.placeName}. ${outcome.action}.`} onMouseEnter={(event) => showTooltip(event.currentTarget)} onMouseLeave={() => setTooltip(null)} onFocus={(event) => showTooltip(event.currentTarget)} onBlur={() => setTooltip(null)} className={`block h-3 w-full rounded-sm outline-none transition-transform hover:scale-y-150 focus-visible:scale-y-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${outcome.mark}`} />
        </span>;
      })}
    </div>
    {tooltip && typeof document !== "undefined" ? createPortal((() => {
      const lesson = lessons.find((item) => item.id === tooltip.lessonId);
      const outcome = outcomes[lesson?.outcome ?? "upcoming"];
      return <span role="tooltip" style={{ left: tooltip.left, top: tooltip.top, transform: "translate(-50%, -100%)" } as CSSProperties} className="pointer-events-none fixed z-[120] w-64 rounded-card bg-ink px-4 py-3 text-left text-xs leading-5 text-canvas shadow-lg">
        <span className="flex items-center justify-between gap-3"><strong className="font-medium">{outcome.label}</strong><span className="opacity-65">{lesson?.timeLabel}</span></span>
        <span className="mt-1 block text-sm font-medium">{lesson?.dateLabel}</span>
        <span className="mt-1 block opacity-75">{lesson?.productName} · {lesson?.teacherName}</span>
        <span className="block opacity-75">{lesson?.placeName}</span>
        <span className="mt-2 block border-t border-canvas/20 pt-2 opacity-65">{outcome.action}</span>
      </span>;
    })(), document.body) : null}
    <p className="mt-2 text-xs leading-5 text-muted">{lessons.length ? Object.entries(counts).map(([outcome, count]) => `${count} ${outcomes[outcome as LessonOutcome].label.toLowerCase()}`).join(" · ") : `No lessons in ${monthLabel}`}</p>
  </div>;
}
