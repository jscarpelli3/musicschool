"use server";

import { revalidatePath } from "next/cache";
import { dispatchLessonCreatedEmail } from "@/lib/notifications/dispatch-lesson-created-email";
import { dispatchLessonRequestEmails } from "@/lib/notifications/dispatch-lesson-request-emails";
import { protectServerAction, RequestBoundaryError } from "@/lib/security/request-boundary";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseRescheduleReason } from "@/lib/scheduling/lesson-domain-contracts";

const outcomes = new Set(["completed", "no_show"]);

export type ServiceAddressState = { status: "idle" | "success" | "error"; message: string; address?: string[] };

export async function revealAssignedLessonAddress(schoolId: string, lessonId: string, _state: ServiceAddressState): Promise<ServiceAddressState> {
  void _state;
  if (![schoolId, lessonId].every((value) => /^[0-9a-f-]{36}$/i.test(value))) return { status: "error", message: "That lesson could not be verified." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) return { status: "error", message: "Sign in again to view this address." };
  try {
    await protectServerAction({ scope: "teacher.service_address.reveal", subject: `actor:${profileId}|school:${schoolId}`, limit: 30, windowSeconds: 600, blockSeconds: 300 });
  } catch {
    return { status: "error", message: "Too many address requests were made. Wait a few minutes and try again." };
  }
  const { data: teacher } = await supabase.from("people").select("id").eq("school_id", schoolId).eq("profile_id", profileId).maybeSingle();
  if (!teacher) return { status: "error", message: "Your teacher record could not be verified." };

  const admin = createAdminClient();
  const { data: lesson } = await admin.from("lesson_events").select("id,student_id,teacher_id,place_id").eq("school_id", schoolId).eq("id", lessonId).maybeSingle();
  if (!lesson || lesson.teacher_id !== teacher.id) return { status: "error", message: "Only the assigned teacher can reveal this address." };
  const { data: place } = await admin.from("lesson_places").select("kind").eq("school_id", schoolId).eq("id", lesson.place_id).maybeSingle();
  if (place?.kind !== "student_home") return { status: "error", message: "This lesson is not scheduled at a student home." };
  const { data: links } = await admin.from("billing_account_students").select("billing_account_id").eq("school_id", schoolId).eq("student_id", lesson.student_id);
  const accountIds = (links ?? []).map((link) => link.billing_account_id);
  const { data: location } = accountIds.length ? await admin.from("family_service_locations").select("id,mode,address_line_1,address_line_2,city,region,postal_code,access_notes").eq("school_id", schoolId).in("billing_account_id", accountIds).eq("status", "active").maybeSingle() : { data: null };
  if (!location) return { status: "error", message: "The family has not provided a home lesson location." };
  if (location.mode === "arranged_privately") return { status: "success", message: "The school has marked this address as arranged privately." };
  const { error: auditError } = await admin.from("service_location_access_log").insert({ school_id: schoolId, service_location_id: location.id, lesson_event_id: lesson.id, actor_profile_id: profileId, purpose: "assigned_lesson" });
  if (auditError) return { status: "error", message: "The address could not be revealed because its access record could not be saved." };
  const address = [location.address_line_1, location.address_line_2, [location.city, location.region, location.postal_code].filter(Boolean).join(", "), location.access_notes ? `Arrival notes: ${location.access_notes}` : null].filter((line): line is string => Boolean(line));
  return { status: "success", message: "Address revealed for this assigned lesson.", address };
}

export async function reportTeacherCancellation(schoolId: string, lessonId: string, reason: string) {
  if (![schoolId, lessonId].every((value) => /^[0-9a-f-]{36}$/i.test(value)) || !reason.trim() || reason.trim().length > 1000) {
    return { ok: false, message: "Explain briefly why you cannot provide this lesson." };
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) return { ok: false, message: "Sign in again before reporting this cancellation." };
  try {
    await protectServerAction({
      scope: "teacher.lesson_cancellation.report",
      subject: `actor:${profileId}|school:${schoolId}|lesson:${lessonId}`,
      limit: 3,
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
  const { data, error } = await supabase.rpc("submit_assigned_teacher_cancellation", {
    p_school_id: schoolId,
    p_lesson_event_id: lessonId,
    p_request_note: reason.trim(),
  });
  if (error) {
    const message = error.message.includes("not_assigned_teacher")
      ? "Only the assigned teacher can report this cancellation."
      : error.message.includes("lesson_not_available")
        ? "This lesson is no longer scheduled."
        : "The cancellation could not be recorded. Nothing changed.";
    return { ok: false, message };
  }
  const requestId = data && typeof data === "object" && "request_id" in data && typeof data.request_id === "string"
    ? data.request_id
    : null;
  if (requestId) await dispatchLessonRequestEmails(requestId);
  revalidatePath(`/schools/${schoolId}/teacher`);
  revalidatePath(`/schools/${schoolId}/approvals`);
  revalidatePath(`/schools/${schoolId}`);
  return { ok: true, message: "Teacher cancellation sent to the owner for remedy review." };
}

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
  const parsedReason = parseRescheduleReason(reason);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localStart) || !parsedReason || reason.trim().length > 500) {
    return { ok: false, message: "Choose a new date and time and give a short reason." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("propose_or_reschedule_assigned_lesson_as_teacher_v2", {
    p_school_id: schoolId,
    p_lesson_event_id: lessonId,
    p_local_start: `${localStart.replace("T", " ")}:00`,
    p_reason_code: parsedReason.code,
    p_reason_detail: parsedReason.detail,
  });
  if (error) {
    const known: Array<[string, string]> = [
      ["lesson_conflict", "The teacher or student already has a lesson at that time."],
      ["proposal_already_pending", "This lesson already has a proposed time waiting for an owner decision."],
      ["lesson_is_not_reschedulable", "This lesson can no longer be rescheduled."],
      ["lesson_reschedule_blocked", "This lesson has been marked as unavailable for rescheduling."],
    ];
    return { ok: false, message: known.find(([code]) => error.message.includes(code))?.[1] ?? "The lesson could not be rescheduled." };
  }
  revalidatePath(`/schools/${schoolId}/teacher`);
  revalidatePath(`/schools/${schoolId}`);
  const outcome = data && typeof data === "object" && "outcome" in data ? data.outcome : null;
  return outcome === "pending_owner"
    ? { ok: true, message: "Proposed time sent to the owner. The lesson remains at its original time until they approve it." }
    : { ok: true, message: "Lesson rescheduled. The owner has been notified." };
}

export async function decideLessonProposal(schoolId: string, proposalId: string, decision: "accept"|"decline") {
  if (![schoolId,proposalId].every((value)=>/^[0-9a-f-]{36}$/i.test(value)) || !new Set(["accept","decline"]).has(decision)) return { ok:false,message:"That proposal could not be verified." };
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("decide_outside_availability_lesson_proposal",{p_school_id:schoolId,p_proposal_id:proposalId,p_decision:decision});
  if(error) return {ok:false,message:error.message.includes("conflict")?"That time now conflicts with another lesson. Nothing changed.":"The proposal could not be updated. Try again."};
  if(data==="withdrawn")return{ok:false,message:"This proposal was withdrawn while you were reviewing it. Nothing changed."};
  if(data==="superseded")return{ok:false,message:"This proposal was replaced while you were reviewing it. Nothing changed; reload to review the new time."};
  if(data==="applied"){
    const {data:proposal}=await supabase.from("lesson_schedule_proposals").select("applied_entity_id,service_entitlement_id").eq("school_id",schoolId).eq("id",proposalId).maybeSingle();
    if(proposal?.applied_entity_id)await dispatchLessonCreatedEmail("lesson_event",proposal.applied_entity_id);
    if(proposal?.service_entitlement_id){
      const {data:entitlement}=await supabase.from("lesson_service_entitlements").select("source_request_id").eq("school_id",schoolId).eq("id",proposal.service_entitlement_id).maybeSingle();
      if(entitlement?.source_request_id)await dispatchLessonRequestEmails(entitlement.source_request_id);
    }
  }
  revalidatePath(`/schools/${schoolId}/teacher`); revalidatePath(`/schools/${schoolId}`);
  return {ok:true,message:data==="applied"?"Lesson accepted and added to the calendar.":"Proposal declined."};
}
