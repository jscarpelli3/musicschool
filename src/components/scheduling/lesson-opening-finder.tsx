"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { LessonCreationOptions } from "./lesson-creation-dialog";
import { clockTime, minutesFromTime } from "@/lib/scheduling/time-options";
import { MdSearch } from "react-icons/md";
import { AppSelect } from "@/components/ui/app-select";

type Opening = { dateKey: string; time: string; teacherId: string; productId?: string; label: string; detail: string };
type DisplayOpening = Opening & { end: number; fitsLesson: boolean; availableMinutes: number };
const addDays = (key: string, days: number) => { const date = new Date(`${key}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
const weekStart = (key: string) => addDays(key, -((new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7));

function localParts(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { dateKey: `${part("year")}-${part("month")}-${part("day")}`, minutes: Number(part("hour")) * 60 + Number(part("minute")) };
}

function mergeWindows(windows: Array<{ start: number; end: number }>) {
  const merged: Array<{ start: number; end: number }> = [];
  for (const window of windows.sort((a, b) => a.start - b.start)) {
    const previous = merged.at(-1);
    if (previous && window.start <= previous.end) previous.end = Math.max(previous.end, window.end);
    else merged.push({ ...window });
  }
  return merged;
}

function filterWindowByTime(window: { start: number; end: number }, preference: string, requested: number) {
  if (preference === "specific") return requested >= window.start && requested < window.end ? window : null;
  const range = preference === "morning" ? { start: 0, end: 720 } : preference === "afternoon" ? { start: 720, end: 1020 } : preference === "evening" ? { start: 1020, end: 1440 } : { start: 0, end: 1440 };
  return Math.max(window.start, range.start) < Math.min(window.end, range.end) ? window : null;
}

function startingMinute(windowStart: number, preference: string, requested: number) {
  if (preference === "specific") return requested;
  if (preference === "afternoon") return Math.max(windowStart, 720);
  if (preference === "evening") return Math.max(windowStart, 1020);
  return windowStart;
}

export function LessonOpeningFinder({ options, timeZone, onChoose }: { options: LessonCreationOptions; timeZone: string; onChoose: (opening: Opening) => void }) {
  const [open, setOpen] = useState(false);
  const [teacherId, setTeacherId] = useState(options.teachers.length === 1 ? options.teachers[0].id : "");
  const [productId, setProductId] = useState("");
  const [dateMode, setDateMode] = useState<"any" | "weekday" | "date">("any");
  const [weekday, setWeekday] = useState("1");
  const [specificDate, setSpecificDate] = useState(options.today);
  const [timePreference, setTimePreference] = useState<"any" | "morning" | "afternoon" | "evening" | "specific">("any");
  const [specificTime, setSpecificTime] = useState("10:00");
  const [selectedWeek, setSelectedWeek] = useState(weekStart(options.today));
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const product = options.products.find((item) => item.id === productId);
  const activeFilter = Boolean(teacherId || productId || dateMode !== "any" || timePreference !== "any");
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(selectedWeek, index)), [selectedWeek]);

  const openings = useMemo(() => {
    if (!activeFilter) return [];
    const teachers = teacherId ? options.teachers.filter((item) => item.id === teacherId) : options.teachers;
    const requested = minutesFromTime(specificTime);
    const results: DisplayOpening[] = [];
    for (const dateKey of dates) {
      if (dateKey < options.today) continue;
      const day = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
      if ((dateMode === "weekday" && day !== Number(weekday)) || (dateMode === "date" && dateKey !== specificDate)) continue;
      for (const teacher of teachers) {
        const rules = mergeWindows(options.availability.filter((rule) => rule.teacher_id === teacher.id && rule.weekday === day && rule.effective_from <= dateKey && (!rule.effective_until || rule.effective_until >= dateKey)).map((rule) => ({ start: minutesFromTime(rule.start_time), end: minutesFromTime(rule.end_time) })));
        const busy = (options.busyLessons ?? []).filter((lesson) => lesson.status !== "cancelled" && (lesson.teacherId === teacher.id || lesson.studentId === options.defaultStudentId)).flatMap((lesson) => { const start = localParts(lesson.startsAt, timeZone); const end = localParts(lesson.endsAt, timeZone); return start.dateKey === dateKey ? [{ start: start.minutes, end: end.minutes }] : []; }).sort((a, b) => a.start - b.start);
        for (const rule of rules) {
          const ruleStart = rule.start, ruleEnd = rule.end;
          const gaps: Array<{ start: number; end: number }> = []; let cursor = ruleStart;
          for (const item of busy.filter((entry) => entry.end > ruleStart && entry.start < ruleEnd)) { if (item.start > cursor) gaps.push({ start: cursor, end: Math.min(item.start, ruleEnd) }); cursor = Math.max(cursor, item.end); }
          if (cursor < ruleEnd) gaps.push({ start: cursor, end: ruleEnd });
          for (const gap of gaps) {
            const earliest = dateKey === options.today && options.minimumTimeToday ? Math.max(gap.start, minutesFromTime(options.minimumTimeToday)) : gap.start;
            const visible = filterWindowByTime({ start: earliest, end: gap.end }, timePreference, requested);
            if (!visible) continue;
            const start = startingMinute(visible.start, timePreference, requested);
            const availableMinutes = visible.end - start;
            const fitsLesson = !product || availableMinutes >= product.durationMinutes;
            const time = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
            results.push({ dateKey, time, teacherId: teacher.id, productId: fitsLesson ? product?.id : undefined, label: teacher.label, detail: `${clockTime(visible.start)}–${clockTime(visible.end)} open`, end: visible.end, fitsLesson, availableMinutes });
          }
        }
      }
    }
    return results;
  }, [activeFilter, dateMode, dates, options, product, specificDate, specificTime, teacherId, timePreference, timeZone, weekday]);

  const control = "w-full rounded-control bg-canvas px-3 py-2.5 text-sm outline-none ring-1 ring-line transition focus:ring-brand";
  const formatDay = (key: string, weekdayName = false) => new Intl.DateTimeFormat("en-US", { ...(weekdayName ? { weekday: "short" as const } : { month: "short" as const }), day: "numeric", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function closeFinder() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function chooseOpening(opening: Opening) {
    closeFinder();
    onChoose(opening);
  }

  const finder = <>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3 text-sm">
        <button type="button" onClick={() => setSelectedWeek((value) => addDays(value, -7))} className="text-muted hover:text-ink">←</button>
        <span className="text-brand">{formatDay(selectedWeek)}–{formatDay(dates[6])}</span>
        <button type="button" onClick={() => setSelectedWeek((value) => addDays(value, 7))} className="text-muted hover:text-ink">→</button>
      </div>
    </div>
    <div className="mt-5 grid gap-3 rounded-card bg-canvas/80 p-3 sm:grid-cols-2 lg:grid-cols-4">
      <label><span className="mb-1.5 block text-xs text-muted">Teacher</span><AppSelect value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className={control}><option value="">Any teacher</option>{options.teachers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</AppSelect></label>
      <label><span className="mb-1.5 block text-xs text-muted">Lesson</span><AppSelect value={productId} onChange={(event) => setProductId(event.target.value)} className={control}><option value="">Any duration</option>{options.products.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.durationMinutes} min</option>)}</AppSelect></label>
      <label><span className="mb-1.5 block text-xs text-muted">Day</span><AppSelect value={dateMode} onChange={(event) => setDateMode(event.target.value as typeof dateMode)} className={control}><option value="any">Any day this week</option><option value="weekday">Day of week</option><option value="date">Specific date</option></AppSelect>{dateMode === "weekday" ? <AppSelect aria-label="Day of week" value={weekday} onChange={(event) => setWeekday(event.target.value)} className={`${control} mt-2`}>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((label,index)=><option key={label} value={index}>{label}</option>)}</AppSelect> : null}{dateMode === "date" ? <input aria-label="Specific date" type="date" min={options.today} value={specificDate} onChange={(event) => { setSpecificDate(event.target.value); setSelectedWeek(weekStart(event.target.value)); }} className={`${control} mt-2`} /> : null}</label>
      <label><span className="mb-1.5 block text-xs text-muted">Time</span><AppSelect value={timePreference} onChange={(event) => setTimePreference(event.target.value as typeof timePreference)} className={control}><option value="any">Any time</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option><option value="specific">Specific time</option></AppSelect>{timePreference === "specific" ? <input aria-label="Specific time" type="time" step={900} value={specificTime} onChange={(event) => setSpecificTime(event.target.value)} className={`${control} mt-2`} /> : null}</label>
    </div>
    {activeFilter ? <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">{dates.map((dateKey) => { const dayOpenings = openings.filter((item) => item.dateKey === dateKey); return <div key={dateKey} className="min-w-0 rounded-control bg-canvas/45 p-2"><p className="px-1 py-1 text-xs text-muted">{formatDay(dateKey, true)}</p><div className="mt-1 space-y-1.5">{dayOpenings.map((opening,index) => opening.fitsLesson ? <button key={`${opening.teacherId}-${opening.time}-${opening.end}-${index}`} type="button" onClick={() => chooseOpening(opening)} className="block w-full rounded-control bg-surface px-2 py-2 text-left transition hover:bg-brand/15"><strong className="block truncate text-xs font-medium">{opening.label}</strong><span className="mt-1 block text-[0.68rem] text-muted">{opening.detail}</span></button> : <div key={`${opening.teacherId}-${opening.time}-${opening.end}-${index}`} className="block w-full rounded-control bg-surface/40 px-2 py-2 text-left opacity-45" title={`Only ${opening.availableMinutes} minutes are open`}><strong className="block truncate text-xs font-medium">{opening.label}</strong><span className="mt-1 block text-[0.68rem] text-muted">{opening.detail}</span><span className="mt-1 block text-[0.64rem] text-muted">Too short for {product?.durationMinutes} min</span></div>)}{!dayOpenings.length ? <p className="px-1 py-3 text-[0.68rem] text-muted">No openings</p> : null}</div></div>; })}</div> : <p className="mt-5 text-sm text-muted">Choose any filter to reveal the week’s matching openings.</p>}
  </>;

  return <>
    <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className="flex h-full min-h-40 w-full flex-col items-center justify-center rounded-card border border-transparent bg-surface-raised/55 px-6 py-7 text-center shadow-[var(--ui-shadow-soft)] transition duration-200 hover:-translate-y-1 hover:scale-[1.025] hover:border-brand/50 hover:bg-surface-raised hover:text-brand hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
      <MdSearch aria-hidden="true" className="mb-2 text-3xl text-brand" />
      <span className="font-display text-3xl font-normal tracking-[-0.03em]">Find an opening</span>
      <span className="mt-2 max-w-xl text-xs leading-5 text-muted">Filter a week by teacher, lesson, day, or time to see exactly what is available.</span>
    </button>
    {open ? <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" aria-label="Close opening finder" onClick={closeFinder} className="fixed inset-0 border-0 bg-[var(--ui-overlay)]" />
      <section className="fixed left-1/2 top-1/2 z-[121] max-h-[calc(100dvh-2rem)] w-[min(72rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-line bg-surface p-6 shadow-xl sm:p-8">
        <header className="relative border-b border-line pb-6 text-center">
          <MdSearch aria-hidden="true" className="mx-auto text-3xl text-brand" />
          <h2 id={titleId} className="mt-2 font-display text-3xl font-normal tracking-[-0.03em]">Find an opening</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">Each choice filters the same weekly availability picture.</p>
          <button type="button" onClick={closeFinder} className="absolute right-0 top-0 text-sm text-muted hover:text-ink">Close</button>
        </header>
        <div className="pt-6">{finder}</div>
      </section>
    </div> : null}
  </>;
}
