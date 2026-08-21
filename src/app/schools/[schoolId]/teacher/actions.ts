"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const outcomes = new Set(["completed", "partial", "no_show"]);

export async function recordTeacherLessonOutcome(
  schoolId: string,
  lessonId: string,
  outcome: string,
  staffNotes: string,
) {
  if (!/^[0-9a-f-]{36}$/i.test(schoolId) || !/^[0-9a-f-]{36}$/i.test(lessonId) || !outcomes.has(outcome)) {
    return { ok: false, message: "Choose a valid lesson result." };
  }
  const notes = staffNotes.trim();
  if (notes.length > 2000) return { ok: false, message: "Keep staff notes under 2,000 characters." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { ok: false, message: "Sign in again before recording this lesson." };

  const { error } = await supabase.rpc("record_lesson_outcome", {
    p_school_id: schoolId,
    p_lesson_event_id: lessonId,
    p_outcome: outcome,
    p_staff_notes: notes || undefined,
  });
  if (error) {
    const known: Array<[string, string]> = [
      ["lesson_has_not_ended", "This lesson can be logged after its scheduled end time."],
      ["lesson_outcome_already_recorded", "This lesson already has a recorded result."],
      ["not_authorized", "Only the assigned teacher or school management can record this lesson."],
    ];
    return { ok: false, message: known.find(([code]) => error.message.includes(code))?.[1] ?? "The lesson could not be recorded." };
  }

  revalidatePath(`/schools/${schoolId}/teacher`);
  revalidatePath(`/schools/${schoolId}`);
  return { ok: true, message: "Lesson result recorded." };
}
