"use client";

import { useMemo, useState } from "react";
import type { LessonCreationOptions } from "./lesson-creation-dialog";
import { clockTime, minutesFromTime } from "@/lib/scheduling/time-options";
import { MdSearch } from "react-icons/md";

type Opening = { dateKey: string; time: string; teacherId: string; productId?: string; label: string; detail: string };
const addDays = (key: string, days: number) => { const date = new Date(`${key}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
const weekStart = (key: string) => addDays(key, -((new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7));

function localParts(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { dateKey: `${part("year")}-${part("month")}-${part("day")}`, minutes: Number(part("hour")) * 60 + Number(part("minute")) };
}

function timeMatches(start: number, preference: string, requested: number) {
  if (preference === "morning") return start < 720;
  if (preference === "afternoon") return start >= 720 && start < 1020;
  if (preference === "evening") return start >= 1020;
  return preference !== "specific" || start === requested;
}

export function LessonOpeningFinder({ options, timeZone, onChoose }: { options: LessonCreationOptions; timeZone: string; onChoose: (opening: Opening) => void }) {
  const [teacherId, setTeacherId] = useState(options.teachers.length === 1 ? options.teachers[0].id : "");
  const [productId, setProductId] = useState("");
  const [dateMode, setDateMode] = useState<"any" | "weekday" | "date">("any");
  const [weekday, setWeekday] = useState("1");
  const [specificDate, setSpecificDate] = useState(options.today);
  const [timePreference, setTimePreference] = useState<"any" | "morning" | "afternoon" | "evening" | "specific">("any");
  const [specificTime, setSpecificTime] = useState("10:00");
  const [selectedWeek, setSelectedWeek] = useState(weekStart(options.today));
  const product = options.products.find((item) => item.id === productId);
  const activeFilter = Boolean(teacherId || productId || dateMode !== "any" || timePreference !== "any");
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(selectedWeek, index)), [selectedWeek]);

  const openings = useMemo(() => {
    if (!activeFilter) return [];
    const teachers = teacherId ? options.teachers.filter((item) => item.id === teacherId) : options.teachers;
    const requested = minutesFromTime(specificTime);
    const results: Opening[] = [];
    for (const dateKey of dates) {
      const day = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
      if ((dateMode === "weekday" && day !== Number(weekday)) || (dateMode === "date" && dateKey !== specificDate)) continue;
      for (const teacher of teachers) {
        const rules = options.availability.filter((rule) => rule.teacher_id === teacher.id && rule.weekday === day && rule.effective_from <= dateKey && (!rule.effective_until || rule.effective_until >= dateKey));
        const busy = (options.busyLessons ?? []).filter((lesson) => lesson.status !== "cancelled" && (lesson.teacherId === teacher.id || lesson.studentId === options.defaultStudentId)).flatMap((lesson) => { const start = localParts(lesson.startsAt, timeZone); const end = localParts(lesson.endsAt, timeZone); return start.dateKey === dateKey ? [{ start: start.minutes, end: end.minutes }] : []; }).sort((a, b) => a.start - b.start);
        for (const rule of rules) {
          const ruleStart = minutesFromTime(rule.start_time), ruleEnd = minutesFromTime(rule.end_time);
          const gaps: Array<{ start: number; end: number }> = []; let cursor = ruleStart;
          for (const item of busy.filter((entry) => entry.end > ruleStart && entry.start < ruleEnd)) { if (item.start > cursor) gaps.push({ start: cursor, end: Math.min(item.start, ruleEnd) }); cursor = Math.max(cursor, item.end); }
          if (cursor < ruleEnd) gaps.push({ start: cursor, end: ruleEnd });
          for (const gap of gaps) {
            if (!product) {
              const start = timePreference === "specific" ? requested : gap.start;
              if (start < gap.start || start >= gap.end || !timeMatches(start, timePreference, requested)) continue;
              const time = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
              results.push({ dateKey, time, teacherId: teacher.id, label: teacher.label, detail: `${clockTime(start)}–${clockTime(gap.end)} open` });
            } else for (let start = gap.start; start + product.durationMinutes <= gap.end; start += 15) {
              if (!timeMatches(start, timePreference, requested) || (dateKey === options.today && options.minimumTimeToday && start < minutesFromTime(options.minimumTimeToday))) continue;
              const time = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
              results.push({ dateKey, time, teacherId: teacher.id, productId: product.id, label: teacher.label, detail: `${clockTime(start)}–${clockTime(start + product.durationMinutes)}` });
            }
          }
        }
      }
    }
    return results;
  }, [activeFilter, dateMode, dates, options, product, specificDate, specificTime, teacherId, timePreference, timeZone, weekday]);

  const control = "w-full rounded-control bg-canvas px-3 py-2.5 text-sm outline-none ring-1 ring-line transition focus:ring-brand";
  const formatDay = (key: string, weekdayName = false) => new Intl.DateTimeFormat("en-US", { ...(weekdayName ? { weekday: "short" as const } : { month: "short" as const }), day: "numeric", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));
  return <section aria-labelledby="opening-finder-title" className="mb-7 bg-surface-raised/55 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><MdSearch aria-hidden="true" className="mt-1 shrink-0 text-xl text-brand" /><div><h3 id="opening-finder-title" className="font-display text-2xl">Find an opening</h3><p className="mt-1 text-xs leading-5 text-muted">Each choice filters the same weekly availability picture.</p></div></div><div className="flex items-center gap-3 text-sm"><button type="button" onClick={() => setSelectedWeek((value) => addDays(value, -7))} className="text-muted hover:text-ink">←</button><span className="text-brand">{formatDay(selectedWeek)}–{formatDay(dates[6])}</span><button type="button" onClick={() => setSelectedWeek((value) => addDays(value, 7))} className="text-muted hover:text-ink">→</button></div></div>
    <div className="mt-5 grid gap-3 rounded-card bg-canvas/80 p-3 sm:grid-cols-2 lg:grid-cols-4">
      <label><span className="mb-1.5 block text-xs text-muted">Teacher</span><select value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className={control}><option value="">Any teacher</option>{options.teachers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label><span className="mb-1.5 block text-xs text-muted">Lesson</span><select value={productId} onChange={(event) => setProductId(event.target.value)} className={control}><option value="">Any duration</option>{options.products.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.durationMinutes} min</option>)}</select></label>
      <label><span className="mb-1.5 block text-xs text-muted">Day</span><select value={dateMode} onChange={(event) => setDateMode(event.target.value as typeof dateMode)} className={control}><option value="any">Any day this week</option><option value="weekday">Day of week</option><option value="date">Specific date</option></select>{dateMode === "weekday" ? <select aria-label="Day of week" value={weekday} onChange={(event) => setWeekday(event.target.value)} className={`${control} mt-2`}>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((label,index)=><option key={label} value={index}>{label}</option>)}</select> : null}{dateMode === "date" ? <input aria-label="Specific date" type="date" min={options.today} value={specificDate} onChange={(event) => { setSpecificDate(event.target.value); setSelectedWeek(weekStart(event.target.value)); }} className={`${control} mt-2`} /> : null}</label>
      <label><span className="mb-1.5 block text-xs text-muted">Time</span><select value={timePreference} onChange={(event) => setTimePreference(event.target.value as typeof timePreference)} className={control}><option value="any">Any time</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option><option value="specific">Specific time</option></select>{timePreference === "specific" ? <input aria-label="Specific time" type="time" step={900} value={specificTime} onChange={(event) => setSpecificTime(event.target.value)} className={`${control} mt-2`} /> : null}</label>
    </div>
    {activeFilter ? <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">{dates.map((dateKey) => { const dayOpenings = openings.filter((item) => item.dateKey === dateKey); return <div key={dateKey} className="min-w-0 rounded-control bg-canvas/45 p-2"><p className="px-1 py-1 text-xs text-muted">{formatDay(dateKey, true)}</p><div className="mt-1 space-y-1.5">{dayOpenings.map((opening,index) => <button key={`${opening.teacherId}-${opening.time}-${index}`} type="button" onClick={() => onChoose(opening)} className="block w-full rounded-control bg-surface px-2 py-2 text-left transition hover:bg-brand/15"><strong className="block truncate text-xs font-medium">{opening.label}</strong><span className="mt-1 block text-[0.68rem] text-muted">{opening.detail}</span></button>)}{!dayOpenings.length ? <p className="px-1 py-3 text-[0.68rem] text-muted">No openings</p> : null}</div></div>; })}</div> : <p className="mt-5 text-sm text-muted">Choose any filter to reveal the week’s matching openings.</p>}
  </section>;
}
