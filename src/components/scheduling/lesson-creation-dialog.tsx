"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSingleLesson, type CreateLessonState } from "@/app/schools/[schoolId]/lessons/new/actions";
import { NewLessonForm, type LessonFormAvailability, type LessonFormOption, type LessonFormProduct, type LessonFormTeacher } from "./new-lesson-form";

export type LessonCreationOptions = {
  students: LessonFormOption[];
  teachers: LessonFormTeacher[];
  products: LessonFormProduct[];
  places: LessonFormOption[];
  availability: LessonFormAvailability[];
  today: string;
  entitlement?: { id: string; studentId: string; productId: string; teacherId: string | null; durationMinutes: number };
};

const initialState: CreateLessonState = { status: "idle", message: "" };

export function LessonCreationDialog({ schoolId, slot, options, lockTeacher, onClose }: {
  schoolId: string;
  slot: { dateKey: string; time: string; teacherId: string };
  options: LessonCreationOptions;
  lockTeacher: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return <div className="reschedule-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="new-lesson-dialog-title">
    <button type="button" aria-label="Return to calendar" className="lesson-sheet-backdrop" onClick={onClose} />
    <section className="reschedule-confirm-panel max-h-[92vh] overflow-y-auto">
      <div className="flex items-start justify-between gap-5 border-b border-line pb-6">
        <div><p className="text-xs uppercase tracking-[0.14em] text-brand">New lesson</p><h3 id="new-lesson-dialog-title" className="mt-3 font-display text-4xl">Add to the calendar.</h3></div>
        <button type="button" onClick={onClose} className="line-action pb-2 text-sm text-muted hover:text-ink">Close</button>
      </div>
      <div className="pt-6">
        <NewLessonForm
          key={`${slot.dateKey}-${slot.time}-${slot.teacherId}`}
          action={createSingleLesson.bind(null, schoolId)}
          initialState={initialState}
          {...options}
          defaultTeacherId={slot.teacherId}
          lockedTeacherId={lockTeacher ? slot.teacherId : undefined}
          initialDate={slot.dateKey}
          initialTime={slot.time}
          entitlement={options.entitlement}
          compact
          onCreated={(result) => {
            onClose();
            window.dispatchEvent(new CustomEvent("common-time:toast", { detail: {
              title: result.outcome === "pending_teacher" ? "Teacher approval requested" : options.entitlement ? "Replacement lesson scheduled" : "Lesson created",
              message: result.outcome === "pending_teacher" ? "Nothing was added to the calendar yet. The teacher must accept the outside-hours proposal." : options.entitlement ? "The paid lesson was scheduled without creating another charge. Family and teacher notifications were queued." : "The calendar was updated and the teacher notification was queued for delivery.",
              href: `/schools/${schoolId}/staff/${slot.teacherId}`,
            } }));
            router.refresh();
          }}
        />
      </div>
    </section>
  </div>;
}
