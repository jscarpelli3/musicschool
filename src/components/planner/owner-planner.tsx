"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { QuickView } from "@/components/ui/quick-view";
import "./owner-planner.css";

type Teacher = { id: string; name: string; isOwner: boolean };
type Availability = {
  id: string;
  teacher_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  effective_from: string;
  effective_until: string | null;
};
type Lesson = {
  id: string;
  product_id: string;
  teacher_id: string;
  student_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  place_id: string;
};

type StudentDetail = {
  name: string;
  email: string | null;
  phone: string | null;
  contacts: Array<{
    name: string;
    relationship: string;
    isPrimary: boolean;
    isBillingContact: boolean;
    email: string | null;
    phone: string | null;
  }>;
  payers: Array<{
    accountName: string;
    name: string;
    email: string | null;
    phone: string | null;
    selfPaying: boolean;
    relationship: string;
  }>;
};

type Props = {
  initialDate: string;
  timezone: string;
  teachers: Teacher[];
  studentNames: Record<string, string>;
  studentDetails: Record<string, StudentDetail>;
  productNames: Record<string, string>;
  placeDetails: Record<string, { name: string; details: string | null }>;
  availability: Availability[];
  lessons: Lesson[];
};

const views = ["day", "week", "month"] as const;
type View = (typeof views)[number];
const dayMs = 86_400_000;
const timelineStart = 8 * 60;
const timelineEnd = 20 * 60;

function fromKey(key: string) {
  return new Date(`${key}T12:00:00`);
}

function key(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * dayMs);
}

function weekDates(anchor: Date) {
  const mondayOffset = anchor.getDay() === 0 ? -6 : 1 - anchor.getDay();
  const monday = addDays(anchor, mondayOffset);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

function monthDates(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
  const gridStart = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function zonedParts(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function clock(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function timeMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function OwnerPlanner({
  initialDate,
  timezone,
  teachers,
  studentNames,
  studentDetails,
  productNames,
  placeDetails,
  availability,
  lessons,
}: Props) {
  const [view, setView] = useState<View>("week");
  const [anchorKey, setAnchorKey] = useState(initialDate);
  const [teacherId, setTeacherId] = useState("all");
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const anchor = fromKey(anchorKey);

  const lessonDetails = useMemo(
    () => lessons.map((lesson) => ({ ...lesson, start: zonedParts(lesson.starts_at, timezone), end: zonedParts(lesson.ends_at, timezone) })),
    [lessons, timezone],
  );
  const selectedLesson = lessonDetails.find((lesson) => lesson.id === selectedLessonId) ?? null;

  useEffect(() => {
    if (!selectedLessonId) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedLessonId(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedLessonId]);

  const visibleTeachers = teacherId === "all" ? teachers : teachers.filter((teacher) => teacher.id === teacherId);
  const activeTeacherIds = new Set(visibleTeachers.map((teacher) => teacher.id));

  function move(direction: -1 | 1) {
    const next = new Date(anchor);
    if (view === "day") next.setDate(next.getDate() + direction);
    if (view === "week") next.setDate(next.getDate() + direction * 7);
    if (view === "month") next.setMonth(next.getMonth() + direction, 1);
    setAnchorKey(key(next));
  }

  const title = view === "day"
    ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(anchor)
    : view === "week"
      ? `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(weekDates(anchor)[0])} — ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(weekDates(anchor)[6])}`
      : new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(anchor);

  return (
    <section className="border-t border-line">
      <div className="grid gap-8 border-b border-line py-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="text-xs text-muted">School planner · {timezone.replaceAll("_", " ")}</p>
          <h2 className="mt-3 font-display text-4xl font-normal tracking-[-0.03em]">{title}</h2>
        </div>
        <div className="flex flex-wrap items-end gap-8">
          <label className="border-b border-line pb-2 text-sm">
            <span className="mr-3 text-muted">Teacher</span>
            <select value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className="bg-transparent outline-none">
              <option value="all">All teachers</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}{teacher.isOwner ? " · you" : ""}</option>)}
            </select>
          </label>
          <div className="flex border-b border-line" role="group" aria-label="Planner view">
            {views.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => setView(option)}
                className={`relative px-4 py-2 text-sm capitalize after:absolute after:right-0 after:bottom-[-1px] after:left-0 after:h-px after:bg-brand after:transition-transform ${view === option ? "text-ink after:scale-x-100" : "text-muted after:scale-x-0 hover:text-ink"}`}
              >{option}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-line py-3">
        <button type="button" onClick={() => move(-1)} className="line-action text-sm text-muted hover:text-ink">← Previous</button>
        <button type="button" onClick={() => setAnchorKey(initialDate)} className="text-sm text-brand hover:text-brand-hover">Today</button>
        <button type="button" onClick={() => move(1)} className="line-action text-sm text-muted hover:text-ink">Next →</button>
      </div>

      {view === "month" ? (
        <MonthView
          anchor={anchor}
          activeTeacherIds={activeTeacherIds}
          availability={availability}
          lessons={lessonDetails}
          studentNames={studentNames}
          onSelectLesson={setSelectedLessonId}
        />
      ) : (
        <TimelineView
          view={view}
          anchor={anchor}
          teachers={visibleTeachers}
          availability={availability}
          lessons={lessonDetails}
          studentNames={studentNames}
          placeDetails={placeDetails}
          onSelectLesson={setSelectedLessonId}
        />
      )}
      {selectedLesson ? (
        <LessonSheet
          lesson={selectedLesson}
          teacherName={teachers.find((teacher) => teacher.id === selectedLesson.teacher_id)?.name ?? "Teacher"}
          student={studentDetails[selectedLesson.student_id]}
          productName={productNames[selectedLesson.product_id] ?? "Lesson"}
          place={placeDetails[selectedLesson.place_id] ?? { name: "Place not set", details: null }}
          onClose={() => setSelectedLessonId(null)}
        />
      ) : null}
    </section>
  );
}

function TimelineView({
  view,
  anchor,
  teachers,
  availability,
  lessons,
  studentNames,
  placeDetails,
  onSelectLesson,
}: {
  view: "day" | "week";
  anchor: Date;
  teachers: Teacher[];
  availability: Availability[];
  lessons: Array<Lesson & { start: ReturnType<typeof zonedParts>; end: ReturnType<typeof zonedParts> }>;
  studentNames: Record<string, string>;
  placeDetails: Record<string, { name: string; details: string | null }>;
  onSelectLesson: (lessonId: string) => void;
}) {
  const [activeTrack, setActiveTrack] = useState<string | null>(null);
  const dates = view === "day" ? [anchor] : weekDates(anchor);
  const columns = view === "day"
    ? teachers.map((teacher) => ({ date: anchor, teachers: [teacher], label: teacher.name }))
    : dates.map((date) => ({ date, teachers, label: new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric" }).format(date) }));
  const hourCount = (timelineEnd - timelineStart) / 60;

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: `${Math.max(760, columns.length * 150)}px` }}>
        <div className="grid border-b border-line" style={{ gridTemplateColumns: `4.5rem repeat(${columns.length}, minmax(0, 1fr))` }}>
          <div />
          {columns.map((column) => <div key={`${key(column.date)}-${column.label}`} className="border-l border-line px-3 py-3 text-sm">{column.label}</div>)}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `4.5rem repeat(${columns.length}, minmax(0, 1fr))` }}>
          <div className="relative" style={{ height: `${hourCount * 60}px` }}>
            {Array.from({ length: hourCount }, (_, index) => (
              <span key={index} className="absolute right-3 text-[10px] text-muted" style={{ top: `${index * 60 - 6}px` }}>{clock(timelineStart + index * 60)}</span>
            ))}
          </div>
          {columns.map((column) => {
            const dateKey = key(column.date);
            const teacherCount = column.teachers.length;
            const activeTeacherIndex = column.teachers.findIndex(
              (teacher) => activeTrack === `${dateKey}:${teacher.id}`,
            );
            return (
              <div
                key={`${dateKey}-${column.label}`}
                className="planner-timeline relative border-l border-line"
                style={{ height: `${hourCount * 60}px` }}
                onPointerLeave={() => setActiveTrack(null)}
              >
                {column.teachers.flatMap((teacher, teacherIndex) => availability
                  .filter((rule) => rule.teacher_id === teacher.id && rule.weekday === column.date.getDay() && rule.effective_from <= dateKey && (!rule.effective_until || rule.effective_until >= dateKey))
                  .map((rule) => {
                    const start = timeMinutes(rule.start_time);
                    const end = timeMinutes(rule.end_time);
                    const trackKey = `${dateKey}:${teacher.id}`;
                    return (
                      <button
                        key={rule.id}
                        type="button"
                        className="availability-block"
                        data-active={activeTrack === trackKey}
                        data-collapsed={activeTeacherIndex >= 0 && activeTrack !== trackKey}
                        title={`${teacher.name} available ${clock(start)}–${clock(end)}`}
                        style={availabilityTrackStyle(start, end, teacherIndex, teacherCount, activeTeacherIndex)}
                        onPointerEnter={() => setActiveTrack(trackKey)}
                        onFocus={() => setActiveTrack(trackKey)}
                        onBlur={() => setActiveTrack(null)}
                      >
                        <span className="availability-label">{teacher.name}</span>
                        <span className="sr-only">{teacher.name} available {clock(start)} to {clock(end)}</span>
                      </button>
                    );
                  }))}
                {lessons
                  .filter((lesson) => lesson.status !== "cancelled" && lesson.start.dateKey === dateKey && column.teachers.some((teacher) => teacher.id === lesson.teacher_id))
                  .map((lesson) => {
                    const teacherIndex = Math.max(0, column.teachers.findIndex((teacher) => teacher.id === lesson.teacher_id));
                    const teacher = column.teachers[teacherIndex];
                    const trackKey = `${dateKey}:${lesson.teacher_id}`;
                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        className="lesson-block quick-view-trigger text-left text-xs"
                        data-active={activeTrack === trackKey}
                        data-collapsed={activeTeacherIndex >= 0 && teacherIndex !== activeTeacherIndex}
                        style={lessonTrackStyle(lesson.start.minutes, lesson.end.minutes, teacherIndex, teacherCount, activeTeacherIndex)}
                        aria-label={`${studentNames[lesson.student_id]} with ${teacher?.name}, ${clock(lesson.start.minutes)}, ${placeDetails[lesson.place_id]?.name ?? "place not set"}. Open lesson details.`}
                        onPointerEnter={() => setActiveTrack(trackKey)}
                        onFocus={() => setActiveTrack(trackKey)}
                        onBlur={() => setActiveTrack(null)}
                        onClick={() => onSelectLesson(lesson.id)}
                      >
                        <span className="lesson-block-content">
                          <span className="lesson-student-name">{studentNames[lesson.student_id]}</span>
                        </span>
                        <QuickView>
                          <span className="block text-sm font-medium">
                            {clock(lesson.start.minutes)}–{clock(lesson.end.minutes)} · {lesson.end.minutes - lesson.start.minutes} min
                          </span>
                          <span className="mt-1 block text-xs opacity-65">{placeDetails[lesson.place_id]?.name ?? "Place not set"}</span>
                        </QuickView>
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function trackStyle(start: number, end: number, track: number, tracks: number, lesson = false): CSSProperties {
  const clippedStart = Math.max(start, timelineStart);
  const clippedEnd = Math.min(end, timelineEnd);
  const gap = tracks > 1 ? 3 : 6;
  return {
    top: `${clippedStart - timelineStart}px`,
    height: `${Math.max(lesson ? 28 : 1, clippedEnd - clippedStart)}px`,
    left: `calc(${(track / tracks) * 100}% + ${gap}px)`,
    width: `calc(${100 / tracks}% - ${gap * 2}px)`,
  };
}

function edgeGeometry(activeTrack: number, tracks: number) {
  const railTarget = 4;
  const leftSpace = activeTrack * railTarget;
  const rightSpace = (tracks - activeTrack - 1) * railTarget;
  return {
    left: leftSpace + 6,
    widthReduction: leftSpace + rightSpace + 12,
  };
}

function collapsedTrackLeft(track: number, tracks: number, activeTrack: number) {
  return track < activeTrack
    ? `${track * 4}px`
    : `calc(100% - ${(tracks - track) * 4}px)`;
}

function availabilityTrackStyle(
  start: number,
  end: number,
  track: number,
  tracks: number,
  activeTrack: number,
): CSSProperties {
  const base = trackStyle(start, end, track, tracks);
  if (activeTrack < 0) return base;

  if (track === activeTrack) {
    const geometry = edgeGeometry(activeTrack, tracks);
    return {
      ...base,
      "--active-left": `${geometry.left}px`,
      "--active-width": `calc(100% - ${geometry.widthReduction}px)`,
    } as CSSProperties;
  }

  return {
    ...base,
    "--collapsed-left": collapsedTrackLeft(track, tracks, activeTrack),
  } as CSSProperties;
}

function lessonTrackStyle(
  start: number,
  end: number,
  track: number,
  tracks: number,
  activeTrack: number,
): CSSProperties {
  const base = trackStyle(start, end, track, tracks, true);
  if (activeTrack < 0) return base;
  if (track !== activeTrack) {
    return {
      ...base,
      "--collapsed-left": collapsedTrackLeft(track, tracks, activeTrack),
    } as CSSProperties;
  }
  const geometry = edgeGeometry(activeTrack, tracks);
  return {
    ...base,
    "--active-lesson-left": `${geometry.left + 4}px`,
    "--active-lesson-width": `calc(100% - ${geometry.widthReduction + 8}px)`,
  } as CSSProperties;
}

function MonthView({
  anchor,
  activeTeacherIds,
  availability,
  lessons,
  studentNames,
  onSelectLesson,
}: {
  anchor: Date;
  activeTeacherIds: Set<string>;
  availability: Availability[];
  lessons: Array<Lesson & { start: ReturnType<typeof zonedParts>; end: ReturnType<typeof zonedParts> }>;
  studentNames: Record<string, string>;
  onSelectLesson: (lessonId: string) => void;
}) {
  const dates = monthDates(anchor);
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-line">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="border-l border-line px-3 py-2 text-xs text-muted first:border-l-0">{day}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {dates.map((date) => {
          const dateKey = key(date);
          const dayLessons = lessons.filter((lesson) => lesson.status !== "cancelled" && lesson.start.dateKey === dateKey && activeTeacherIds.has(lesson.teacher_id));
          const dayRules = availability.filter((rule) => activeTeacherIds.has(rule.teacher_id) && rule.weekday === date.getDay() && rule.effective_from <= dateKey && (!rule.effective_until || rule.effective_until >= dateKey));
          const availableMinutes = dayRules.reduce((total, rule) => total + timeMinutes(rule.end_time) - timeMinutes(rule.start_time), 0);
          const bookedMinutes = dayLessons.reduce((total, lesson) => total + lesson.end.minutes - lesson.start.minutes, 0);
          const occupancy = availableMinutes ? Math.min(100, Math.round((bookedMinutes / availableMinutes) * 100)) : 0;
          const inMonth = date.getMonth() === anchor.getMonth();
          return (
            <div key={dateKey} className={`min-h-36 border-b border-l border-line p-3 first:border-l-0 ${inMonth ? "" : "opacity-30"}`}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm">{date.getDate()}</span>
                {availableMinutes ? <span className="text-[10px] text-muted">{Math.round(availableMinutes / 60)}h open</span> : null}
              </div>
              <div className="mt-5 space-y-1">
                {dayLessons.slice(0, 2).map((lesson) => (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => onSelectLesson(lesson.id)}
                    className="block w-full truncate text-left text-[11px] text-muted hover:text-brand-hover"
                  >
                    {clock(lesson.start.minutes)} · {studentNames[lesson.student_id]}
                  </button>
                ))}
                {dayLessons.length > 2 ? <p className="text-[10px] text-brand">+{dayLessons.length - 2} more</p> : null}
              </div>
              {availableMinutes ? (
                <div className="mt-5">
                  <div className="occupancy-line" style={{ "--occupancy": `${occupancy}%` } as CSSProperties} />
                  <p className="mt-2 text-[10px] text-muted">{dayLessons.length} booked · {occupancy}%</p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LessonSheet({
  lesson,
  teacherName,
  student,
  productName,
  place,
  onClose,
}: {
  lesson: Lesson & { start: ReturnType<typeof zonedParts>; end: ReturnType<typeof zonedParts> };
  teacherName: string;
  student: StudentDetail | undefined;
  productName: string;
  place: { name: string; details: string | null };
  onClose: () => void;
}) {
  const duration = lesson.end.minutes - lesson.start.minutes;
  return (
    <>
      <button type="button" aria-label="Close lesson details" className="lesson-sheet-backdrop" onClick={onClose} />
      <aside className="lesson-sheet px-7 py-8 md:px-10" role="dialog" aria-modal="true" aria-labelledby="lesson-sheet-title">
        <div className="flex items-start justify-between gap-6 border-b border-line pb-7">
          <div>
            <p className="text-xs capitalize text-brand">{lesson.status}</p>
            <h2 id="lesson-sheet-title" className="mt-4 font-display text-4xl font-normal tracking-[-0.035em]">
              {student?.name ?? "Student"}
            </h2>
          </div>
          <button autoFocus type="button" onClick={onClose} className="line-action pb-2 text-sm text-muted hover:text-ink">Close</button>
        </div>

        <dl className="divide-y divide-line border-b border-line">
          <Detail label="Lesson" value={productName} />
          <Detail label="Teacher" value={teacherName} />
          <Detail label="Date" value={new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(fromKey(lesson.start.dateKey))} />
          <Detail label="Time" value={`${clock(lesson.start.minutes)}–${clock(lesson.end.minutes)} · ${duration} minutes`} />
          <Detail label="Place" value={place.details ? `${place.name} · ${place.details}` : place.name} />
        </dl>

        <section className="border-b border-line py-8">
          <h3 className="font-display text-2xl font-normal">Student</h3>
          <p className="mt-4 text-sm">{student?.name}</p>
          {student?.email ? <p className="mt-1 text-sm text-muted">{student.email}</p> : null}
          {student?.phone ? <p className="mt-1 text-sm text-muted">{student.phone}</p> : null}
        </section>

        <section className="border-b border-line py-8">
          <h3 className="font-display text-2xl font-normal">Parent or guardian</h3>
          {student?.contacts.length ? student.contacts.map((contact) => (
            <div key={`${contact.name}-${contact.relationship}`} className="mt-5">
              <p className="text-sm">{contact.name}</p>
              <p className="mt-1 text-xs capitalize text-muted">
                {contact.relationship}{contact.isPrimary ? " · primary" : ""}{contact.isBillingContact ? " · billing contact" : ""}
              </p>
              {contact.email ? <p className="mt-2 text-sm text-muted">{contact.email}</p> : null}
              {contact.phone ? <p className="mt-1 text-sm text-muted">{contact.phone}</p> : null}
            </div>
          )) : <p className="mt-4 text-sm text-muted">No parent or guardian attached.</p>}
        </section>

        <section className="py-8">
          <h3 className="font-display text-2xl font-normal">Payer</h3>
          {student?.payers.length ? student.payers.map((payer) => (
            <div key={`${payer.accountName}-${payer.name}`} className="mt-5">
              <p className="text-sm">{payer.name}</p>
              <p className="mt-1 text-xs text-brand">{payer.selfPaying ? "Self-paying student" : payer.accountName}</p>
              {payer.email ? <p className="mt-2 text-sm text-muted">{payer.email}</p> : null}
              {payer.phone ? <p className="mt-1 text-sm text-muted">{payer.phone}</p> : null}
            </div>
          )) : <p className="mt-4 text-sm text-muted">No billing account attached.</p>}
        </section>
      </aside>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-5 py-5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
