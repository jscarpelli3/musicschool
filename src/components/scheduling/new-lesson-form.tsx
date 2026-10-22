"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import type { CreateLessonPlaceState, CreateLessonState } from "@/app/schools/[schoolId]/lessons/new/actions";
import { clockTime, fiveMinuteTimeOptions, minutesFromTime } from "@/lib/scheduling/time-options";
import { AppSelect } from "@/components/ui/app-select";

export type LessonFormOption = { id: string; label: string };
export type LessonFormTeacher = LessonFormOption & { outsideAvailabilityPolicy?: "notify_only" | "require_approval" };
export type LessonFormProduct = LessonFormOption & { durationMinutes: number; priceLabel: string; defaultScheduleType: "one_time" | "weekly" };
export type LessonFormAvailability = {
  id: string;
  teacher_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  effective_from: string;
  effective_until: string | null;
};
export type LessonFormBusyLesson = { teacherId: string; studentId: string; startsAt: string; endsAt: string; status: string };

const field = "w-full border-b border-line bg-transparent py-3 outline-none transition focus:border-brand";

function localLessonParts(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, minutes: Number(part("hour")) * 60 + Number(part("minute")) };
}

function SubmitLessonButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="border border-brand px-6 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:cursor-wait disabled:opacity-60">
    {pending ? "Creating lesson…" : "Create lesson →"}
  </button>;
}

function AvailabilityContext({
  teacher,
  date,
  time,
  duration,
  availability,
}: {
  teacher: LessonFormTeacher | undefined;
  date: string;
  time: string;
  duration: number | undefined;
  availability: LessonFormAvailability[];
}) {
  if (!teacher || !date || !time) return null;
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const blocks = availability.filter((rule) => rule.teacher_id === teacher.id
    && rule.weekday === weekday
    && rule.effective_from <= date
    && (!rule.effective_until || rule.effective_until >= date));
  const start = minutesFromTime(time);
  const end = duration ? start + duration : start;
  const containingBlock = duration ? blocks.find((rule) => minutesFromTime(rule.start_time) <= start && minutesFromTime(rule.end_time) >= end) : undefined;
  const outside = Boolean(duration && !containingBlock);
  const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));

  return <div className={`md:col-span-2 border p-4 text-sm ${containingBlock ? "border-brand/40 bg-brand/10" : "border-line bg-surface"}`}>
    <p className="font-medium">{teacher.label}’s availability · {dayLabel}</p>
    {blocks.length ? <p className="mt-2 text-muted">{blocks.map((block) => `${clockTime(minutesFromTime(block.start_time))}–${clockTime(minutesFromTime(block.end_time))}`).join(" · ")}</p> : <p className="mt-2 text-muted">No recurring availability is saved for this day.</p>}
    {duration ? <p className={`mt-3 ${containingBlock ? "text-brand" : "text-danger"}`}>
      {containingBlock
        ? `The selected ${duration}-minute lesson fits inside a saved block.`
        : `The selected ${duration}-minute lesson does not fit completely inside a saved block.`}
    </p> : <p className="mt-3 text-muted">Choose a lesson offering to check whether the full lesson fits.</p>}
    {outside ? <div className="mt-4 border-l-2 border-brand pl-4">
      <p className="font-medium text-ink">{teacher.outsideAvailabilityPolicy === "require_approval"
        ? "This teacher must approve lessons outside their availability. Nothing will be added until they accept."
        : "This teacher will be notified that the lesson is outside their availability."}</p>
      <label className="mt-3 block"><span className="text-xs text-muted">Optional note for the teacher</span><input name="outside_availability_note" maxLength={240} className={field} /></label>
    </div> : null}
  </div>;
}

export function NewLessonForm({
  action,
  createPlaceAction,
  initialState,
  students,
  teachers,
  products,
  places,
  availability,
  today,
  defaultTeacherId,
  defaultStudentId,
  primaryTeacherByStudent = {},
  defaultProductId,
  initialDate,
  initialTime = "",
  lockedTeacherId,
  compact = false,
  onCreated,
  entitlement,
  minimumTimeToday,
  busyLessons = [],
  timeZone,
}: {
  action: (state: CreateLessonState, formData: FormData) => Promise<CreateLessonState>;
  createPlaceAction: (formData: FormData) => Promise<CreateLessonPlaceState>;
  initialState: CreateLessonState;
  students: LessonFormOption[];
  teachers: LessonFormTeacher[];
  products: LessonFormProduct[];
  places: LessonFormOption[];
  availability: LessonFormAvailability[];
  today: string;
  defaultTeacherId?: string;
  defaultStudentId?: string;
  primaryTeacherByStudent?: Record<string, string>;
  defaultProductId?: string;
  initialDate?: string;
  initialTime?: string;
  lockedTeacherId?: string;
  compact?: boolean;
  onCreated?: (state: CreateLessonState) => void;
  entitlement?: { id: string; studentId: string; productId: string; teacherId: string | null; durationMinutes: number };
  minimumTimeToday?: string;
  busyLessons?: LessonFormBusyLesson[];
  timeZone: string;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const startingStudentId = entitlement?.studentId ?? defaultStudentId ?? "";
  const studentPrimaryTeacherId = primaryTeacherByStudent[startingStudentId];
  const startingTeacherId = lockedTeacherId ?? (teachers.some((teacher) => teacher.id === defaultTeacherId) ? defaultTeacherId! : teachers.some((teacher) => teacher.id === studentPrimaryTeacherId) ? studentPrimaryTeacherId : "");
  const [studentId, setStudentId] = useState(startingStudentId);
  const [teacherId, setTeacherId] = useState(startingTeacherId);
  const startingProductId = entitlement?.productId ?? (products.some((product) => product.id === defaultProductId) ? defaultProductId! : "");
  const [productId, setProductId] = useState(startingProductId);
  const [date, setDate] = useState(initialDate ?? today);
  const [time, setTime] = useState(initialTime);
  const [placeId, setPlaceId] = useState("");
  const [availablePlaces, setAvailablePlaces] = useState(places);
  const [showNewPlace, setShowNewPlace] = useState(false);
  const [placeName, setPlaceName] = useState("");
  const [placeDetails, setPlaceDetails] = useState("");
  const [placeMessage, setPlaceMessage] = useState("");
  const [placePending, startPlaceTransition] = useTransition();
  const [conflictMessage, setConflictMessage] = useState("");
  const [scheduleType, setScheduleType] = useState<"one_time" | "weekly">(entitlement ? "one_time" : products.find((item) => item.id === startingProductId)?.defaultScheduleType ?? "weekly");
  const createdHandled = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const timeRef = useRef<HTMLSelectElement>(null);
  const teacher = useMemo(() => teachers.find((option) => option.id === teacherId), [teacherId, teachers]);
  const product = useMemo(() => products.find((option) => option.id === productId), [productId, products]);
  const busyWindowsFor = (candidateTeacherId: string, candidateDate: string) => busyLessons.filter((lesson) => lesson.teacherId === candidateTeacherId && !["cancelled", "rescheduled"].includes(lesson.status)).flatMap((lesson) => {
    const start = localLessonParts(lesson.startsAt, timeZone), end = localLessonParts(lesson.endsAt, timeZone);
    return start.date === candidateDate ? [{ start: start.minutes, end: end.minutes }] : [];
  });
  const conflictsAt = (value: string, candidateTeacherId = teacherId, candidateDate = date, candidateProduct = product) => {
    if (!value || !candidateTeacherId) return false;
    const start = minutesFromTime(value), end = start + (candidateProduct?.durationMinutes ?? 1);
    return busyWindowsFor(candidateTeacherId, candidateDate).some((window) => window.start < end && window.end > start);
  };
  const invalidateConflictingTime = (candidateTeacherId: string, candidateDate: string, candidateProduct = product) => {
    if (!time || !conflictsAt(time, candidateTeacherId, candidateDate, candidateProduct)) return;
    const invalidTime = clockTime(minutesFromTime(time));
    const candidateTeacher = teachers.find((option) => option.id === candidateTeacherId);
    setTime("");
    setConflictMessage(`${invalidTime} is already occupied for ${candidateTeacher?.label ?? "that teacher"}. Choose another time.`);
    window.dispatchEvent(new CustomEvent("common-time:toast", { detail: { title: "That time is not available", message: `${candidateTeacher?.label ?? "The selected teacher"} already has a lesson that overlaps ${invalidTime}. The time was cleared.` } }));
  };
  const defaultEndDate = useMemo(() => {
    const end = new Date(`${date}T12:00:00`);
    end.setDate(end.getDate() + 84);
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  }, [date]);

  useEffect(() => {
    if (state.status !== "success" || createdHandled.current) return;
    createdHandled.current = true;
    onCreated?.(state);
  }, [onCreated, state]);

  useEffect(() => {
    if (state.status !== "error") return;
    errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (state.field === "time") timeRef.current?.focus();
    window.dispatchEvent(new CustomEvent("common-time:toast", { detail: {
      title: "Lesson not scheduled",
      message: `${state.message} Nothing was added to the calendar; your other choices are still here.`,
    } }));
  }, [state]);

  return <form action={formAction} className={compact ? "grid" : "grid md:grid-cols-[1fr_2fr]"}>
    {entitlement ? <input type="hidden" name="entitlement_id" value={entitlement.id} /> : null}
    {!compact ? <div className="border-b border-line py-9 md:border-r md:border-b-0 md:pr-10">
      <h2 className="font-display text-3xl">The plan</h2>
      <p className="mt-3 text-sm leading-6 text-muted">Create one lesson or a weekly series. Availability is guidance; conflicts remain blocked.</p>
    </div> : null}
    <div className={`grid gap-7 md:grid-cols-2 ${compact ? "py-2" : "py-9 md:pl-10"}`}>
      {state.message ? <p ref={errorRef} role={state.status === "error" ? "alert" : "status"} className={`md:col-span-2 border p-4 text-sm ${state.status === "success" ? "border-brand/40 bg-brand/10 text-brand" : "border-danger/40 bg-danger/10 text-danger"}`}>{state.message}{state.status === "error" ? " Nothing was added; correct the highlighted field and try again." : ""}</p> : null}
      <label className="md:col-span-2"><span className="text-xs text-muted">Student</span><AppSelect required name="student_id" value={studentId} onChange={(event) => { const nextStudentId = event.target.value; const nextTeacherId = lockedTeacherId ?? primaryTeacherByStudent[nextStudentId] ?? ""; setStudentId(nextStudentId); if (!lockedTeacherId) setTeacherId(nextTeacherId); invalidateConflictingTime(nextTeacherId, date); }} disabled={Boolean(entitlement)} className={field}><option value="" disabled>Select a student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}</AppSelect>{entitlement ? <><input type="hidden" name="student_id" value={entitlement.studentId} /><span className="mt-2 block text-xs text-brand">Replacement lesson · this student is fixed</span></> : null}</label>
      {lockedTeacherId ? <div><span className="text-xs text-muted">Teacher</span><p className="border-b border-line py-3">{teacher?.label}</p><input type="hidden" name="teacher_id" value={lockedTeacherId} /></div> : <label><span className="text-xs text-muted">Teacher</span><AppSelect required name="teacher_id" value={teacherId} onChange={(event) => { setTeacherId(event.target.value); invalidateConflictingTime(event.target.value, date); }} className={field}><option value="" disabled>Select a teacher</option>{teachers.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</AppSelect></label>}
      <label><span className="text-xs text-muted">Lesson offering</span><AppSelect required name="product_id" value={productId} disabled={Boolean(entitlement)} onChange={(event) => { const nextProduct = products.find((option) => option.id === event.target.value); setProductId(event.target.value); if (nextProduct && !entitlement) setScheduleType(nextProduct.defaultScheduleType); invalidateConflictingTime(teacherId, date, nextProduct); }} className={field}><option value="" disabled>Select an offering</option>{products.map((option) => <option key={option.id} value={option.id}>{option.label} · {option.durationMinutes} min · {entitlement?"no new charge":option.priceLabel}</option>)}</AppSelect>{entitlement ? <input type="hidden" name="product_id" value={entitlement.productId} /> : null}</label>
      <label><span className="text-xs text-muted">Date</span><input required name="date" type="date" min={today} value={date} onChange={(event) => { setDate(event.target.value); invalidateConflictingTime(teacherId, event.target.value); }} className={field} /></label>
      <label><span className="text-xs text-muted">Start time</span><AppSelect ref={timeRef} required name="time" value={time} aria-invalid={state.field === "time" || Boolean(conflictMessage)} onChange={(event) => { setTime(event.target.value); setConflictMessage(""); }} className={`${field} ${state.field === "time" || conflictMessage ? "border-danger" : ""}`}><option value="" disabled>Select a time</option>{fiveMinuteTimeOptions.map((option) => { const passed = date === today && Boolean(minimumTimeToday) && option.value <= minimumTimeToday!; const booked = conflictsAt(option.value); return <option key={option.value} value={option.value} disabled={passed || booked}>{option.label}{passed ? " · passed" : booked ? " · teacher booked" : ""}</option>; })}</AppSelect><span className="mt-2 block text-[11px] text-muted">Five-minute increments{date === today && minimumTimeToday ? ` · choose a time after ${clockTime(minutesFromTime(minimumTimeToday))}` : ""}</span></label>
      {conflictMessage ? <div role="alert" className="md:col-span-2 border-2 border-danger bg-danger/10 p-4 text-sm text-danger"><p className="font-medium">Selected time cleared</p><p className="mt-1">{conflictMessage}</p></div> : null}
      {date === today ? <div className="md:col-span-2 border border-brand/50 bg-brand/10 p-4 text-sm"><p className="font-medium text-ink">This lesson is today.</p><p className="mt-1 text-muted">Only a future time will be accepted. Confirm the teacher and family expect this short-notice addition.</p></div> : null}
      {entitlement ? <input type="hidden" name="schedule_type" value="one_time" /> : <fieldset className="md:col-span-2"><legend className="text-xs text-muted">Schedule</legend><div className="mt-3 flex gap-6 text-sm"><label className="flex items-center gap-2"><input type="radio" name="schedule_type" value="weekly" checked={scheduleType === "weekly"} onChange={() => setScheduleType("weekly")} />Weekly series</label><label className="flex items-center gap-2"><input type="radio" name="schedule_type" value="one_time" checked={scheduleType === "one_time"} onChange={() => setScheduleType("one_time")} />One lesson</label></div><p className="mt-2 text-[11px] text-muted">This offering’s usual choice is preselected. You can change it for this lesson.</p></fieldset>}
      {scheduleType === "weekly" ? <label className="md:col-span-2"><span className="text-xs text-muted">Repeat weekly through</span><input required name="ends_on" type="date" min={date} max={(() => { const max = new Date(`${date}T12:00:00`); max.setDate(max.getDate() + 371); return `${max.getFullYear()}-${String(max.getMonth()+1).padStart(2,"0")}-${String(max.getDate()).padStart(2,"0")}`; })()} defaultValue={defaultEndDate} key={defaultEndDate} className={field} /><span className="mt-2 block text-[11px] text-muted">Defaults to twelve weeks; adjust as needed.</span></label> : null}
      <AvailabilityContext teacher={teacher} date={date} time={time} duration={product?.durationMinutes} availability={availability} />
      <div className="md:col-span-2">
        <label><span className="text-xs text-muted">Place</span><AppSelect required name="place_id" value={placeId} onChange={(event) => setPlaceId(event.target.value)} className={field}><option value="" disabled>{availablePlaces.length ? "Select a place" : "No lesson places yet"}</option>{availablePlaces.map((place) => <option key={place.id} value={place.id}>{place.label}</option>)}</AppSelect></label>
        <button type="button" onClick={() => { setShowNewPlace((current) => !current); setPlaceMessage(""); }} className="mt-2 text-xs text-brand hover:text-brand-hover">{showNewPlace ? "Cancel" : "+ Add a new place"}</button>
        {showNewPlace ? <div className="mt-4 rounded-md bg-surface-raised p-4">
          <p className="text-sm font-medium">New place</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label><span className="text-xs text-muted">Place name</span><input value={placeName} onChange={(event) => setPlaceName(event.target.value)} maxLength={120} className={field} placeholder="Studio A" /></label>
            <label><span className="text-xs text-muted">Address, room, or video link <span className="opacity-60">optional</span></span><input value={placeDetails} onChange={(event) => setPlaceDetails(event.target.value)} maxLength={500} className={field} /></label>
          </div>
          {placeMessage ? <p role="status" className="mt-3 text-xs text-danger">{placeMessage}</p> : null}
          <button type="button" disabled={placePending || !placeName.trim()} onClick={() => {
            const data = new FormData();
            data.set("name", placeName);
            data.set("details", placeDetails);
            startPlaceTransition(async () => {
              const result = await createPlaceAction(data);
              setPlaceMessage(result.message);
              if (!result.place) return;
              setAvailablePlaces((current) => [...current.filter((place) => place.id !== result.place!.id), result.place!].sort((a, b) => a.label.localeCompare(b.label)));
              setPlaceId(result.place.id);
              setPlaceName("");
              setPlaceDetails("");
              setShowNewPlace(false);
              window.dispatchEvent(new CustomEvent("common-time:toast", { detail: { title: "Place added", message: result.message } }));
            });
          }} className="mt-4 rounded-md bg-brand px-4 py-2 text-sm text-surface transition hover:opacity-90 disabled:opacity-50">{placePending ? "Adding…" : "Add and select place"}</button>
        </div> : null}
      </div>
      <label className="md:col-span-2"><span className="text-xs text-muted">Internal notes</span><textarea name="notes" maxLength={1000} rows={3} className={field} /></label>
      <div className="md:col-span-2 flex justify-end"><SubmitLessonButton /></div>
    </div>
  </form>;
}
