"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const outcomes = new Set(["completed", "no_show"]);

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

export async function rescheduleTeacherLesson(schoolId: string, lessonId: string, localStart: string, reason: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localStart) || !reason.trim() || reason.trim().length > 500) {
    return { ok: false, message: "Choose a new date and time and give a short reason." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reschedule_assigned_lesson_as_teacher", {
    p_school_id: schoolId,
    p_lesson_event_id: lessonId,
    p_local_start: `${localStart.replace("T", " ")}:00`,
    p_reason: reason.trim(),
  });
  if (error) {
    const known: Array<[string, string]> = [
      ["teacher_reschedule_not_allowed", "The school has not enabled teacher rescheduling for your account."],
      ["outside_teacher_availability", "Choose a time within your recorded availability."],
      ["teacher_conflict", "You already have a lesson at that time."],
      ["student_conflict", "The student already has a lesson at that time."],
      ["lesson_is_not_reschedulable", "This lesson can no longer be rescheduled."],
    ];
    return { ok: false, message: known.find(([code]) => error.message.includes(code))?.[1] ?? "The lesson could not be rescheduled." };
  }
  revalidatePath(`/schools/${schoolId}/teacher`);
  revalidatePath(`/schools/${schoolId}`);
  return { ok: true, message: "Lesson rescheduled. The owner has been notified." };
}

export async function reportStudentRescheduleRequest(schoolId: string, lessonId: string, note: string) {
  if (note.trim().length > 1000) return { ok: false, message: "Keep the note under 1,000 characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_student_reschedule_request_to_owner", {
    p_school_id: schoolId,
    p_lesson_event_id: lessonId,
    p_note: note.trim() || undefined,
  });
  if (error) return { ok: false, message: "The request could not be sent to the owner." };
  return { ok: true, message: "The owner has been notified. The lesson has not moved yet." };
}

export async function decideLessonProposal(schoolId: string, proposalId: string, decision: "accept"|"decline") {
  if (![schoolId,proposalId].every((value)=>/^[0-9a-f-]{36}$/i.test(value)) || !new Set(["accept","decline"]).has(decision)) return { ok:false,message:"That proposal could not be verified." };
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("decide_outside_availability_lesson_proposal",{p_school_id:schoolId,p_proposal_id:proposalId,p_decision:decision});
  if(error) return {ok:false,message:error.message.includes("conflict")?"That time now conflicts with another lesson. Nothing changed.":"The proposal could not be updated. Try again."};
  revalidatePath(`/schools/${schoolId}/teacher`); revalidatePath(`/schools/${schoolId}`);
  return {ok:true,message:data==="applied"?"Lesson accepted and added to the calendar.":"Proposal declined."};
}
