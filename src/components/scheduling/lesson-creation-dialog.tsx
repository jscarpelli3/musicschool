"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createLessonPlace, createSingleLesson, getStudentHomeLocationState, type CreateLessonState } from "@/app/schools/[schoolId]/lessons/new/actions";
import { NewLessonForm, type LessonFormAvailability, type LessonFormOption, type LessonFormPlace, type LessonFormProduct, type LessonFormTeacher } from "./new-lesson-form";
import styles from "./lesson-creation-dialog.module.css";

export type LessonCreationOptions = {
  students: LessonFormOption[];
  teachers: LessonFormTeacher[];
  products: LessonFormProduct[];
  places: LessonFormPlace[];
  availability: LessonFormAvailability[];
  today: string;
  minimumTimeToday?: string;
  defaultStudentId?: string;
  primaryTeacherByStudent?: Record<string, string>;
  busyLessons?: Array<{ teacherId: string; studentId: string; startsAt: string; endsAt: string; status: string }>;
  entitlement?: { id: string; studentId: string; productId: string; teacherId: string | null; durationMinutes: number };
};

const initialState: CreateLessonState = { status: "idle", message: "" };

export function LessonCreationDialog({ schoolId, slot, options, lockTeacher, timeZone, onClose }: {
  schoolId: string;
  slot: { dateKey: string; time: string; teacherId: string; productId?: string };
  options: LessonCreationOptions;
  lockTeacher: boolean;
  timeZone: string;
  onClose: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return <div className={styles.layer} role="dialog" aria-modal="true" aria-labelledby="new-lesson-dialog-title">
    <button type="button" aria-label="Return to calendar" className={styles.backdrop} onClick={onClose} />
    <section className={styles.panel}>
      <div className="flex items-start justify-between gap-5 border-b border-line pb-6">
        <div><p className="text-xs uppercase tracking-[0.14em] text-brand">New lesson</p><h3 id="new-lesson-dialog-title" className="mt-3 font-display text-4xl">Add to the calendar.</h3></div>
        <button type="button" onClick={onClose} className="text-action text-sm text-muted hover:text-ink">Close</button>
      </div>
      <div className="pt-6">
        <NewLessonForm
          key={`${slot.dateKey}-${slot.time}-${slot.teacherId}`}
          action={createSingleLesson.bind(null, schoolId)}
          createPlaceAction={createLessonPlace.bind(null, schoolId)}
          checkHomeLocationAction={getStudentHomeLocationState.bind(null, schoolId)}
          initialState={initialState}
          {...options}
          defaultTeacherId={slot.teacherId}
          defaultStudentId={options.defaultStudentId}
          primaryTeacherByStudent={options.primaryTeacherByStudent}
          defaultProductId={slot.productId}
          lockedTeacherId={lockTeacher ? slot.teacherId : undefined}
          initialDate={slot.dateKey}
          initialTime={slot.time}
          entitlement={options.entitlement}
          minimumTimeToday={options.minimumTimeToday}
          busyLessons={options.busyLessons}
          timeZone={timeZone}
          compact
          onCreated={(result) => {
            onClose();
            window.dispatchEvent(new CustomEvent("common-time:toast", { detail: {
              title: result.outcome === "pending_teacher" ? "Teacher approval requested" : options.entitlement ? "Replacement lesson scheduled" : "Lesson created",
              message: result.outcome === "pending_teacher" ? (result.scheduledForToday ? "This proposal is for later today. Nothing was added yet; the teacher must accept it." : "Nothing was added to the calendar yet. The teacher must accept the outside-hours proposal.") : options.entitlement ? (result.scheduledForToday ? "The replacement lesson was scheduled for later today. Confirm everyone expects it; notifications were queued." : "The replacement lesson was scheduled without creating another charge. Family and teacher notifications were queued.") : result.scheduledForToday ? "This lesson is later today. Confirm the teacher and family expect it; notifications were queued." : "The calendar was updated and the teacher notification was queued for delivery.",
              ...(slot.teacherId ? { href: `/schools/${schoolId}/staff/${slot.teacherId}` } : {}),
            } }));
            router.refresh();
          }}
        />
      </div>
    </section>
  </div>;
}
