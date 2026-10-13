"use client";

import { useMemo, useState } from "react";
import type { LessonCreationOptions } from "./lesson-creation-dialog";
import { clockTime, minutesFromTime } from "@/lib/scheduling/time-options";
import { MdSearch } from "react-icons/md";

type Opening = { dateKey: string; time: string; teacherId: string; productId: string; label: string; detail: string };

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function localParts(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { dateKey: `${part("year")}-${part("month")}-${part("day")}`, minutes: Number(part("hour")) * 60 + Number(part("minute")) };
}

export function LessonOpeningFinder({ options, timeZone, onChoose }: { options: LessonCreationOptions; timeZone: string; onChoose: (opening: Opening) => void }) {
  const [teacherId, setTeacherId] = useState(options.teachers.length === 1 ? options.teachers[0].id : "");
  const [productId, setProductId] = useState("");
  const [dateMode, setDateMode] = useState<"any" | "weekday" | "date">("any");
  const [weekday, setWeekday] = useState("1");
  const [specificDate, setSpecificDate] = useState(options.today);
  const [timePreference, setTimePreference] = useState<"any" | "morning" | "afternoon" | "evening" | "specific">("any");
  const [specificTime, setSpecificTime] = useState("10:00");
  const product = options.products.find((item) => item.id === productId);
  const teacher = options.teachers.find((item) => item.id === teacherId);

  const openings = useMemo(() => {
    if (!teacher || !product) return [];
    const wantedMinute = minutesFromTime(specificTime);
    const dates = dateMode === "date" ? [specificDate] : Array.from({ length: 42 }, (_, index) => addDays(options.today, index));
    const results: Opening[] = [];
    for (const dateKey of dates) {
      const day = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
      if (dateMode === "weekday" && day !== Number(weekday)) continue;
      const rules = options.availability.filter((rule) => rule.teacher_id === teacher.id && rule.weekday === day && rule.effective_from <= dateKey && (!rule.effective_until || rule.effective_until >= dateKey));
      const busy = (options.busyLessons ?? []).filter((lesson) => lesson.status !== "cancelled" && (lesson.teacherId === teacher.id || lesson.studentId === options.defaultStudentId)).flatMap((lesson) => {
        const start = localParts(lesson.startsAt, timeZone); const end = localParts(lesson.endsAt, timeZone);
        return start.dateKey === dateKey ? [{ start: start.minutes, end: end.minutes }] : [];
      });
      for (const rule of rules) {
        const ruleStart = minutesFromTime(rule.start_time); const ruleEnd = minutesFromTime(rule.end_time);
        for (let start = ruleStart; start + product.durationMinutes <= ruleEnd; start += 15) {
          if (timePreference === "morning" && start >= 12 * 60) continue;
          if (timePreference === "afternoon" && (start < 12 * 60 || start >= 17 * 60)) continue;
          if (timePreference === "evening" && start < 17 * 60) continue;
          if (timePreference === "specific" && start !== wantedMinute) continue;
          if (dateKey === options.today && options.minimumTimeToday && start < minutesFromTime(options.minimumTimeToday)) continue;
          if (busy.some((item) => item.start < start + product.durationMinutes && item.end > start)) continue;
          const time = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
          results.push({ dateKey, time, teacherId: teacher.id, productId: product.id, label: new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00Z`)), detail: `${clockTime(start)}–${clockTime(start + product.durationMinutes)} · ${teacher.label}` });
          if (results.length === 8) return results;
        }
      }
    }
    return results;
  }, [dateMode, options, product, specificDate, specificTime, teacher, timePreference, timeZone, weekday]);

  const field = "w-full border-b border-line bg-transparent py-2 text-sm outline-none focus:border-brand";
  return <section aria-labelledby="opening-finder-title" className="mb-7 border border-line bg-surface-raised/55 p-4 sm:p-5">
    <div className="flex items-start gap-3"><MdSearch aria-hidden="true" className="mt-1 shrink-0 text-xl text-brand" /><div><h3 id="opening-finder-title" className="font-display text-2xl">Find an opening</h3><p className="mt-1 text-xs leading-5 text-muted">Choose a lesson first so every result fits its full duration.</p></div></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label><span className="text-xs text-muted">Teacher</span><select value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className={field}><option value="">Choose teacher</option>{options.teachers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label><span className="text-xs text-muted">Lesson</span><select value={productId} onChange={(event) => setProductId(event.target.value)} className={field}><option value="">Choose lesson</option>{options.products.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.durationMinutes} min</option>)}</select></label>
      <label><span className="text-xs text-muted">Day</span><select value={dateMode} onChange={(event) => setDateMode(event.target.value as typeof dateMode)} className={field}><option value="any">Any upcoming day</option><option value="weekday">Day of week</option><option value="date">Specific date</option></select>{dateMode === "weekday" ? <select aria-label="Day of week" value={weekday} onChange={(event) => setWeekday(event.target.value)} className={field}>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((label,index)=><option key={label} value={index}>{label}</option>)}</select> : null}{dateMode === "date" ? <input aria-label="Specific date" type="date" min={options.today} value={specificDate} onChange={(event) => setSpecificDate(event.target.value)} className={field} /> : null}</label>
      <label><span className="text-xs text-muted">Time</span><select value={timePreference} onChange={(event) => setTimePreference(event.target.value as typeof timePreference)} className={field}><option value="any">Any time</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option><option value="specific">Specific time</option></select>{timePreference === "specific" ? <input aria-label="Specific time" type="time" step={900} value={specificTime} onChange={(event) => setSpecificTime(event.target.value)} className={field} /> : null}</label>
    </div>
    {teacher && product ? <div className="mt-5 border-t border-line pt-4"><p className="text-xs uppercase tracking-[0.14em] text-muted">Best available</p>{openings.length ? <div className="mt-3 flex flex-wrap gap-2">{openings.map((opening) => <button key={`${opening.dateKey}-${opening.time}`} type="button" onClick={() => onChoose(opening)} className="rounded-control border border-line bg-canvas px-3 py-2 text-left text-sm transition hover:border-brand hover:text-brand"><strong className="block font-medium">{opening.label}</strong><span className="mt-1 block text-xs text-muted">{opening.detail}</span></button>)}</div> : <p className="mt-3 text-sm text-muted">No fitting openings were found in the next six weeks. Change the day, time, teacher, or lesson.</p>}</div> : <p className="mt-5 border-t border-line pt-4 text-sm text-muted">Choose a teacher and lesson to see real openings.</p>}
  </section>;
}
