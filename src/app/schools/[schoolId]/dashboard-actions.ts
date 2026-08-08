"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Column, RosterViewSettings } from "@/components/students/student-roster-table";

const columns: Column[] = ["family", "student", "parent", "day", "time", "teacher", "place", "month"];
const modeCounts: Record<Column, number> = {
  family: 2,
  student: 4,
  parent: 4,
  day: 2,
  time: 1,
  teacher: 2,
  place: 2,
  month: 6,
};

export async function saveStudentRosterView(schoolId: string, settings: RosterViewSettings) {
  const validColumns = Array.isArray(settings.columns)
    && settings.columns.length === columns.length
    && columns.every((column) => settings.columns.includes(column));
  const validSort = columns.includes(settings.sort.column)
    && Number.isInteger(settings.sort.mode)
    && settings.sort.mode >= 0
    && settings.sort.mode < modeCounts[settings.sort.column];
  if (!validColumns || !validSort) return;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;
  if (!profileId) throw new Error("Authentication required.");

  const { error } = await supabase.from("user_view_preferences").upsert({
    school_id: schoolId,
    profile_id: profileId,
    view_key: "student_roster",
    settings,
  }, { onConflict: "school_id,profile_id,view_key" });
  if (error) throw new Error("View preferences could not be saved.");
}

export type OwnerRescheduleInput = {
  lessonId: string;
  teacherId: string;
  placeId: string;
  localStart: string;
  reason: string;
  allowOutsideAvailability: boolean;
};

export async function rescheduleOwnerLesson(schoolId: string, input: OwnerRescheduleInput) {
  if (![input.lessonId, input.teacherId, input.placeId].every((value) => /^[0-9a-f-]{36}$/i.test(value))
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.localStart)
    || input.reason.trim().length < 1 || input.reason.trim().length > 500) {
    return { ok: false, message: "Check the proposed lesson details and record a reason." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { ok: false, message: "Sign in again before rescheduling." };

  const { error } = await supabase.rpc("reschedule_lesson_as_owner", {
    p_school_id: schoolId,
    p_lesson_event_id: input.lessonId,
    p_teacher_id: input.teacherId,
    p_place_id: input.placeId,
    p_local_start: input.localStart.replace("T", " ") + ":00",
    p_source: "calendar",
    p_reason: input.reason.trim(),
    p_allow_outside_availability: input.allowOutsideAvailability,
  });

  if (error) {
    const messages: Array<[string, string]> = [
      ["teacher_conflict", "That teacher already has a lesson at the proposed time."],
      ["student_conflict", "The student already has a lesson at the proposed time."],
      ["outside_teacher_availability", "That time is outside the teacher’s availability."],
      ["lesson_is_not_reschedulable", "This lesson is no longer eligible to be rescheduled."],
      ["past_lesson_is_not_reschedulable", "Past lessons require an administrative correction instead."],
      ["new_lesson_time_must_be_future", "Choose a future lesson time."],
      ["lesson_time_is_unchanged", "Choose a different time, teacher, or place."],
    ];
    return { ok: false, message: messages.find(([code]) => error.message.includes(code))?.[1] ?? "The lesson could not be moved. Nothing changed." };
  }

  revalidatePath(`/schools/${schoolId}`);
  return { ok: true, message: "Lesson rescheduled and history recorded." };
}
