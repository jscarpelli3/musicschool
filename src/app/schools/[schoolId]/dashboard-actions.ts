"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseRescheduleReason } from "@/lib/scheduling/lesson-domain-contracts";
import type { Column, RosterViewSettings } from "@/components/students/student-roster-table";
import { dispatchLessonRequestEmails } from "@/lib/notifications/dispatch-lesson-request-emails";
import { protectServerAction, RequestBoundaryError } from "@/lib/security/request-boundary";

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

export async function reportSchoolCancellation(schoolId: string, lessonId: string, note: string) {
  if (![schoolId, lessonId].every((value) => /^[0-9a-f-]{36}$/i.test(value)) || !note.trim() || note.trim().length > 1000) {
    return { ok: false, message: "Explain briefly why the school cannot provide this lesson." };
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) return { ok: false, message: "Sign in again before reporting this cancellation." };
  try {
    await protectServerAction({
      scope: "school.lesson_cancellation.report",
      subject: `actor:${profileId}|school:${schoolId}|lesson:${lessonId}`,
      limit: 5,
      windowSeconds: 3600,
      blockSeconds: 900,
    });
  } catch (caught) {
    return {
      ok: false,
      message: caught instanceof RequestBoundaryError && caught.code === "rate_limited"
        ? "This cancellation was already submitted or too many attempts were made. Reload before trying again."
        : "This report could not be validated. Reload and try again.",
    };
  }
  const { data, error } = await supabase.rpc("submit_school_cancellation", {
    p_school_id: schoolId,
    p_lesson_event_id: lessonId,
    p_request_note: note.trim(),
  });
  if (error) {
    const message = error.message.includes("not_authorized")
      ? "Only an owner or administrator can report a school cancellation."
      : error.message.includes("lesson_not_available")
        ? "This lesson is no longer scheduled."
        : "The school cancellation could not be recorded. Nothing changed.";
    return { ok: false, message };
  }
  const requestId = data && typeof data === "object" && "request_id" in data && typeof data.request_id === "string"
    ? data.request_id
    : null;
  if (requestId) await dispatchLessonRequestEmails(requestId);
  revalidatePath(`/schools/${schoolId}`);
  revalidatePath(`/schools/${schoolId}/approvals`);
  revalidatePath(`/schools/${schoolId}/teacher`);
  return { ok: true, message: "School cancellation sent for scenario-specific remedy review." };
}

export async function setLessonReschedulePermission(schoolId: string, lessonId: string, allowed: boolean, blockedReason: string) {
  if (![schoolId, lessonId].every((value) => /^[0-9a-f-]{36}$/i.test(value))
    || (!allowed && (!blockedReason.trim() || blockedReason.trim().length > 300))) {
    return { ok: false, message: "Give a short reason for blocking rescheduling." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_lesson_reschedule_permission", {
    p_school_id: schoolId,
    p_lesson_event_id: lessonId,
    p_allowed: allowed,
    p_blocked_reason: allowed ? undefined : blockedReason.trim(),
  });
  if (error) return { ok: false, message: "The rescheduling permission could not be changed." };
  revalidatePath(`/schools/${schoolId}`);
  return { ok: true, message: allowed ? "Rescheduling enabled." : "Rescheduling blocked." };
}

export async function rescheduleOwnerLesson(schoolId: string, input: OwnerRescheduleInput) {
  const reason = parseRescheduleReason(input.reason);
  if (![input.lessonId, input.teacherId, input.placeId].every((value) => /^[0-9a-f-]{36}$/i.test(value))
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.localStart)
    || !reason
    || input.reason.trim().length > 500) {
    return { ok: false, message: "Check the proposed lesson details and record a reason." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { ok: false, message: "Sign in again before rescheduling." };

  const { error } = await supabase.rpc("reschedule_lesson_as_owner_v2", {
    p_school_id: schoolId,
    p_lesson_event_id: input.lessonId,
    p_teacher_id: input.teacherId,
    p_place_id: input.placeId,
    p_local_start: input.localStart.replace("T", " ") + ":00",
    p_source: "calendar",
    p_reason_code: reason.code,
    p_reason_detail: reason.detail,
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
      ["lesson_reschedule_blocked", "This lesson has been marked as non-reschedulable."],
    ];
    return { ok: false, message: messages.find(([code]) => error.message.includes(code))?.[1] ?? "The lesson could not be moved. Nothing changed." };
  }

  revalidatePath(`/schools/${schoolId}`);
  return { ok: true, message: "Lesson rescheduled and history recorded." };
}
