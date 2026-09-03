"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { CreateLessonState } from "@/app/schools/[schoolId]/lessons/new/actions";
import { clockTime, fiveMinuteTimeOptions, minutesFromTime } from "@/lib/scheduling/time-options";

export type LessonFormOption = { id: string; label: string };
export type LessonFormTeacher = LessonFormOption & { outsideAvailabilityPolicy?: "notify_only" | "require_approval" };
export type LessonFormProduct = LessonFormOption & { durationMinutes: number; priceLabel: string };
export type LessonFormAvailability = {
  id: string;
  teacher_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  effective_from: string;
  effective_until: string | null;
};

const field = "w-full border-b border-line bg-transparent py-3 outline-none transition focus:border-brand";

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
  initialState,
  students,
  teachers,
  products,
  places,
  availability,
  today,
  defaultTeacherId,
  initialDate,
  initialTime = "",
  lockedTeacherId,
  compact = false,
  onCreated,
  entitlement,
}: {
  action: (state: CreateLessonState, formData: FormData) => Promise<CreateLessonState>;
  initialState: CreateLessonState;
  students: LessonFormOption[];
  teachers: LessonFormTeacher[];
  products: LessonFormProduct[];
  places: LessonFormOption[];
  availability: LessonFormAvailability[];
  today: string;
  defaultTeacherId?: string;
  initialDate?: string;
  initialTime?: string;
  lockedTeacherId?: string;
  compact?: boolean;
  onCreated?: (state: CreateLessonState) => void;
  entitlement?: { id: string; studentId: string; productId: string; teacherId: string | null; durationMinutes: number };
}) {
  const [state, formAction] = useActionState(action, initialState);
  const startingTeacherId = lockedTeacherId ?? (teachers.some((teacher) => teacher.id === defaultTeacherId) ? defaultTeacherId! : "");
  const [teacherId, setTeacherId] = useState(startingTeacherId);
  const [productId, setProductId] = useState(entitlement?.productId ?? "");
  const [date, setDate] = useState(initialDate ?? today);
  const [time, setTime] = useState(initialTime);
  const [scheduleType, setScheduleType] = useState("one_time");
  const createdHandled = useRef(false);
  const teacher = useMemo(() => teachers.find((option) => option.id === teacherId), [teacherId, teachers]);
  const product = useMemo(() => products.find((option) => option.id === productId), [productId, products]);
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

  return <form action={formAction} className={compact ? "grid" : "grid md:grid-cols-[1fr_2fr]"}>
    {entitlement ? <input type="hidden" name="entitlement_id" value={entitlement.id} /> : null}
    {!compact ? <div className="border-b border-line py-9 md:border-r md:border-b-0 md:pr-10">
      <h2 className="font-display text-3xl">The plan</h2>
      <p className="mt-3 text-sm leading-6 text-muted">Create one lesson or a weekly series. Availability is guidance; conflicts remain blocked.</p>
    </div> : null}
    <div className={`grid gap-7 md:grid-cols-2 ${compact ? "py-2" : "py-9 md:pl-10"}`}>
      {state.message ? <p role={state.status === "error" ? "alert" : "status"} className={`md:col-span-2 border p-4 text-sm ${state.status === "success" ? "border-brand/40 bg-brand/10 text-brand" : "border-danger/40 bg-danger/10 text-danger"}`}>{state.message}</p> : null}
      <label className="md:col-span-2"><span className="text-xs text-muted">Student</span><select required name="student_id" defaultValue={entitlement?.studentId ?? ""} disabled={Boolean(entitlement)} className={field}><option value="" disabled>Select a student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}</select>{entitlement ? <><input type="hidden" name="student_id" value={entitlement.studentId} /><span className="mt-2 block text-xs text-brand">Paid replacement lesson · this student is fixed</span></> : null}</label>
      {lockedTeacherId ? <div><span className="text-xs text-muted">Teacher</span><p className="border-b border-line py-3">{teacher?.label}</p><input type="hidden" name="teacher_id" value={lockedTeacherId} /></div> : <label><span className="text-xs text-muted">Teacher</span><select required name="teacher_id" value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className={field}><option value="" disabled>Select a teacher</option>{teachers.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
      <label><span className="text-xs text-muted">Lesson offering</span><select required name="product_id" value={productId} disabled={Boolean(entitlement)} onChange={(event) => setProductId(event.target.value)} className={field}><option value="" disabled>Select an offering</option>{products.map((option) => <option key={option.id} value={option.id}>{option.label} · {option.durationMinutes} min · {option.priceLabel}</option>)}</select>{entitlement ? <input type="hidden" name="product_id" value={entitlement.productId} /> : null}</label>
      <label><span className="text-xs text-muted">Date</span><input required name="date" type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} className={field} /></label>
      <label><span className="text-xs text-muted">Start time</span><select required name="time" value={time} onChange={(event) => setTime(event.target.value)} className={field}><option value="" disabled>Select a time</option>{fiveMinuteTimeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className="mt-2 block text-[11px] text-muted">Five-minute increments</span></label>
      {entitlement ? <input type="hidden" name="schedule_type" value="one_time" /> : <fieldset className="md:col-span-2"><legend className="text-xs text-muted">Repeats</legend><div className="mt-3 flex gap-6 text-sm"><label className="flex items-center gap-2"><input type="radio" name="schedule_type" value="one_time" checked={scheduleType === "one_time"} onChange={() => setScheduleType("one_time")} />One time</label><label className="flex items-center gap-2"><input type="radio" name="schedule_type" value="weekly" checked={scheduleType === "weekly"} onChange={() => setScheduleType("weekly")} />Weekly</label></div></fieldset>}
      {scheduleType === "weekly" ? <label className="md:col-span-2"><span className="text-xs text-muted">Repeat weekly through</span><input required name="ends_on" type="date" min={date} max={(() => { const max = new Date(`${date}T12:00:00`); max.setDate(max.getDate() + 371); return `${max.getFullYear()}-${String(max.getMonth()+1).padStart(2,"0")}-${String(max.getDate()).padStart(2,"0")}`; })()} defaultValue={defaultEndDate} key={defaultEndDate} className={field} /><span className="mt-2 block text-[11px] text-muted">Defaults to twelve weeks; adjust as needed.</span></label> : null}
      <AvailabilityContext teacher={teacher} date={date} time={time} duration={product?.durationMinutes} availability={availability} />
      <label className="md:col-span-2"><span className="text-xs text-muted">Place</span><select required name="place_id" defaultValue="" className={field}><option value="" disabled>Select a place</option>{places.map((place) => <option key={place.id} value={place.id}>{place.label}</option>)}</select></label>
      <label className="md:col-span-2"><span className="text-xs text-muted">Internal notes</span><textarea name="notes" maxLength={1000} rows={3} className={field} /></label>
      <div className="md:col-span-2 flex justify-end"><SubmitLessonButton /></div>
    </div>
  </form>;
}
