"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { CreateLessonState } from "@/app/schools/[schoolId]/lessons/new/actions";
import { clockTime, fiveMinuteTimeOptions, minutesFromTime } from "@/lib/scheduling/time-options";

type Option = { id: string; label: string };
type Product = Option & { durationMinutes: number; priceLabel: string };
type Availability = {
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
  teacher: Option | undefined;
  date: string;
  time: string;
  duration: number | undefined;
  availability: Availability[];
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
  const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));

  return <div className={`md:col-span-2 border p-4 text-sm ${containingBlock ? "border-brand/40 bg-brand/10" : "border-line bg-surface"}`}>
    <p className="font-medium">{teacher.label}’s availability · {dayLabel}</p>
    {blocks.length ? <p className="mt-2 text-muted">{blocks.map((block) => `${clockTime(minutesFromTime(block.start_time))}–${clockTime(minutesFromTime(block.end_time))}`).join(" · ")}</p> : <p className="mt-2 text-muted">No recurring availability is saved for this day.</p>}
    {duration ? <p className={`mt-3 ${containingBlock ? "text-brand" : "text-danger"}`}>
      {containingBlock
        ? `The selected ${duration}-minute lesson fits inside a saved block.`
        : `The selected ${duration}-minute lesson does not fit completely inside a saved block. You can choose another time or explicitly override availability below.`}
    </p> : <p className="mt-3 text-muted">Choose a lesson offering to check whether the full lesson fits.</p>}
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
}: {
  action: (state: CreateLessonState, formData: FormData) => Promise<CreateLessonState>;
  initialState: CreateLessonState;
  students: Option[];
  teachers: Option[];
  products: Product[];
  places: Option[];
  availability: Availability[];
  today: string;
  defaultTeacherId?: string;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const [teacherId, setTeacherId] = useState(teachers.some((teacher) => teacher.id === defaultTeacherId) ? defaultTeacherId! : "");
  const [productId, setProductId] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const teacher = useMemo(() => teachers.find((option) => option.id === teacherId), [teacherId, teachers]);
  const product = useMemo(() => products.find((option) => option.id === productId), [productId, products]);

  return <form action={formAction} className="grid md:grid-cols-[1fr_2fr]">
    <div className="border-b border-line py-9 md:border-r md:border-b-0 md:pr-10">
      <h2 className="font-display text-3xl">The plan</h2>
      <p className="mt-3 text-sm leading-6 text-muted">Creates one calendar occurrence. Availability is guidance; conflicts remain blocked.</p>
    </div>
    <div className="grid gap-7 py-9 md:grid-cols-2 md:pl-10">
      {state.message ? <p role={state.status === "error" ? "alert" : "status"} className={`md:col-span-2 border p-4 text-sm ${state.status === "success" ? "border-brand/40 bg-brand/10 text-brand" : "border-danger/40 bg-danger/10 text-danger"}`}>{state.message}</p> : null}
      <label className="md:col-span-2"><span className="text-xs text-muted">Student</span><select required name="student_id" defaultValue="" className={field}><option value="" disabled>Select a student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.label}</option>)}</select></label>
      <label><span className="text-xs text-muted">Teacher</span><select required name="teacher_id" value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className={field}><option value="" disabled>Select a teacher</option>{teachers.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label><span className="text-xs text-muted">Lesson offering</span><select required name="product_id" value={productId} onChange={(event) => setProductId(event.target.value)} className={field}><option value="" disabled>Select an offering</option>{products.map((option) => <option key={option.id} value={option.id}>{option.label} · {option.durationMinutes} min · {option.priceLabel}</option>)}</select></label>
      <label><span className="text-xs text-muted">Date</span><input required name="date" type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} className={field} /></label>
      <label><span className="text-xs text-muted">Start time</span><select required name="time" value={time} onChange={(event) => setTime(event.target.value)} className={field}><option value="" disabled>Select a time</option>{fiveMinuteTimeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className="mt-2 block text-[11px] text-muted">Five-minute increments</span></label>
      <AvailabilityContext teacher={teacher} date={date} time={time} duration={product?.durationMinutes} availability={availability} />
      <label className="md:col-span-2"><span className="text-xs text-muted">Place</span><select required name="place_id" defaultValue="" className={field}><option value="" disabled>Select a place</option>{places.map((place) => <option key={place.id} value={place.id}>{place.label}</option>)}</select></label>
      <label className="md:col-span-2"><span className="text-xs text-muted">Internal notes</span><textarea name="notes" maxLength={1000} rows={3} className={field} /></label>
      <div className="md:col-span-2 border-l border-line pl-4"><label className="flex items-start gap-3 text-sm"><input name="allow_outside_availability" type="checkbox" className="mt-1 accent-[var(--color-brand)]" /><span>Allow outside this teacher’s availability</span></label><label className="mt-4 block"><span className="text-xs text-muted">Override reason, required when checked</span><input name="override_reason" maxLength={240} className={field} /></label></div>
      <div className="md:col-span-2 flex justify-end"><SubmitLessonButton /></div>
    </div>
  </form>;
}
