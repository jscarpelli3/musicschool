"use server";

import { revalidatePath } from "next/cache";
import { dispatchLessonCreatedEmail } from "@/lib/notifications/dispatch-lesson-created-email";
import { dispatchLessonProposalEmail } from "@/lib/notifications/dispatch-lesson-proposal-email";
import { protectServerAction, RequestBoundaryError } from "@/lib/security/request-boundary";
import { createClient } from "@/lib/supabase/server";

export type CreateLessonState = {
  status: "idle" | "success" | "error";
  message: string;
  reference?: string;
  outcome?: "created" | "pending_teacher";
};

const knownErrors: Record<string, string> = {
  outside_teacher_availability: "That lesson does not fit inside the teacher’s saved availability. Choose another time or record an override.",
  teacher_conflict: "That teacher already has a lesson during this time.",
  student_conflict: "That student already has a lesson during this time.",
  override_reason_required: "Explain why this lesson is being scheduled outside normal availability.",
  invalid_school_or_offering: "That lesson offering is no longer available. Reload and choose another offering.",
  group_class_requires_roster: "Group classes cannot be created with this private-lesson form.",
  invalid_teacher: "That teacher is no longer available at this school. Reload and choose another teacher.",
  invalid_student: "That student is no longer available for scheduling. Reload and choose another student.",
  invalid_place: "That lesson place is no longer available. Reload and choose another place.",
  lesson_too_far_in_past: "A new lesson cannot be created that far in the past.",
  invalid_recurrence_end: "Choose an end date from the first lesson through one year later.",
  standalone_lesson_requires_per_session_price: "That offering is billed as a recurring agreement. Choose Weekly instead of One time.",
  not_authorized: "Your account does not have permission to create lessons for this school.",
};

export async function createSingleLesson(
  schoolId: string,
  _previousState: CreateLessonState,
  formData: FormData,
): Promise<CreateLessonState> {
  const productId = String(formData.get("product_id") ?? "");
  const teacherId = String(formData.get("teacher_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");
  const placeId = String(formData.get("place_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const scheduleType = String(formData.get("schedule_type") ?? "one_time");
  const endsOn = String(formData.get("ends_on") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const outsideNote = String(formData.get("outside_availability_note") ?? "").trim() || undefined;

  if (![schoolId, productId, teacherId, studentId, placeId].every((value) => /^[0-9a-f-]{36}$/i.test(value))
      || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)
      || !["one_time", "weekly"].includes(scheduleType)
      || (scheduleType === "weekly" && !/^\d{4}-\d{2}-\d{2}$/.test(endsOn))
      || Number(time.slice(3)) % 5 !== 0
      || (notes?.length ?? 0) > 1000 || (outsideNote?.length ?? 0) > 240) {
    return { status: "error", message: "Check the lesson details and try again." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) return { status: "error", message: "Your session expired. Sign in again before creating the lesson." };
  try {
    await protectServerAction({ scope: "lesson.create", subject: `actor:${profileId}|school:${schoolId}`, limit: 30, windowSeconds: 600, blockSeconds: 300 });
  } catch (caught) {
    return { status: "error", message: caught instanceof RequestBoundaryError && caught.code === "rate_limited" ? "Too many lesson changes were submitted. Wait a few minutes and try again." : "This request could not be validated. Reload and try again." };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("school_members")
    .select("role")
    .eq("school_id", schoolId)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return { status: "error", message: "School access could not be verified. Nothing was added; try again." };
  if (membership?.role !== "owner" && membership?.role !== "admin") {
    return { status: "error", message: knownErrors.not_authorized };
  }

  const [{ data: school }, { data: product }, { data: teacherPolicy }, { data: rules }] = await Promise.all([
    supabase.from("schools").select("timezone").eq("id", schoolId).maybeSingle(),
    supabase.from("service_products").select("duration_minutes").eq("school_id", schoolId).eq("id", productId).eq("status", "active").maybeSingle(),
    supabase.from("teachers").select("outside_availability_policy").eq("school_id", schoolId).eq("person_id", teacherId).maybeSingle(),
    supabase.from("teacher_availability_rules").select("weekday,start_time,end_time,effective_from,effective_until").eq("school_id", schoolId).eq("teacher_id", teacherId),
  ]);
  if (!school || !product || !teacherPolicy) return { status: "error", message: "The teacher’s scheduling policy could not be verified. Nothing was added; reload and try again." };
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const startMinutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const endMinutes = startMinutes + product.duration_minutes;
  const fitsAvailability = (rules ?? []).some((rule) => {
    const ruleStart = Number(rule.start_time.slice(0, 2)) * 60 + Number(rule.start_time.slice(3, 5));
    const ruleEnd = Number(rule.end_time.slice(0, 2)) * 60 + Number(rule.end_time.slice(3, 5));
    return rule.weekday === weekday && rule.effective_from <= date && (!rule.effective_until || rule.effective_until >= date)
      && ruleStart <= startMinutes && ruleEnd >= endMinutes;
  });
  const allowOutside = !fitsAvailability;
  const overrideReason = allowOutside ? outsideNote ?? "Owner scheduled outside the teacher’s saved availability." : undefined;

  if (allowOutside && teacherPolicy.outside_availability_policy === "require_approval") {
    const { data: proposalId, error: proposalError } = await supabase.rpc("create_outside_availability_lesson_proposal", {
      p_school_id: schoolId, p_product_id: productId, p_teacher_id: teacherId, p_student_id: studentId, p_place_id: placeId,
      p_local_start: `${date} ${time}:00`, p_schedule_type: scheduleType, p_ends_on: scheduleType === "weekly" ? endsOn : date,
      p_notes: notes ?? "", p_reason: overrideReason!,
    });
    if (proposalError || !proposalId) {
      const knownCode = Object.keys(knownErrors).find((code) => proposalError?.message.includes(code));
      const reference = crypto.randomUUID().slice(0, 8).toUpperCase();
      console.error("Lesson approval proposal failure", { reference, schoolId, teacherId, code: proposalError?.code, message: proposalError?.message });
      return { status: "error", message: knownCode ? knownErrors[knownCode] : `The approval request could not be created. Nothing was added, so it is safe to try again. Reference ${reference}.`, reference };
    }
    await dispatchLessonProposalEmail(proposalId);
    revalidatePath(`/schools/${schoolId}/teacher`);
    return { status: "success", outcome: "pending_teacher", message: "Approval requested. The lesson will be added only if the teacher accepts." };
  }

  const result = scheduleType === "weekly"
    ? await supabase.rpc("create_weekly_lesson_series", {
        p_school_id: schoolId, p_product_id: productId, p_teacher_id: teacherId, p_student_id: studentId,
        p_place_id: placeId, p_local_start: `${date} ${time}:00`, p_ends_on: endsOn, p_notes: notes,
        p_allow_outside_availability: allowOutside, p_override_reason: overrideReason,
      })
    : await supabase.rpc("create_single_lesson", {
        p_school_id: schoolId, p_product_id: productId, p_teacher_id: teacherId, p_student_id: studentId,
        p_place_id: placeId, p_local_start: `${date} ${time}:00`, p_notes: notes,
        p_allow_outside_availability: allowOutside, p_override_reason: overrideReason,
      });
  const { data: createdRecord, error } = result;

  if (error || !createdRecord) {
    const knownCode = Object.keys(knownErrors).find((code) => error?.message.includes(code));
    if (knownCode) return { status: "error", message: knownErrors[knownCode] };
    const reference = crypto.randomUUID().slice(0, 8).toUpperCase();
    console.error("Unexpected lesson creation failure", { reference, schoolId, teacherId, code: error?.code });
    return {
      status: "error",
      message: `The lesson could not be created. Nothing was added, so it is safe to try again. Reference ${reference}.`,
      reference,
    };
  }

  revalidatePath(`/schools/${schoolId}`);
  revalidatePath(`/schools/${schoolId}/teacher`);
  revalidatePath(`/schools/${schoolId}/staff/${teacherId}`);
  const occurrenceCount = scheduleType === "weekly" && typeof createdRecord === "object" && createdRecord !== null && !Array.isArray(createdRecord)
    ? Number((createdRecord as Record<string, unknown>).occurrence_count ?? 0)
    : 1;
  const createdId = scheduleType === "weekly" && typeof createdRecord === "object" && createdRecord !== null && !Array.isArray(createdRecord)
    ? String((createdRecord as Record<string, unknown>).series_id ?? "")
    : String(createdRecord);
  if (/^[0-9a-f-]{36}$/i.test(createdId)) {
    await dispatchLessonCreatedEmail(scheduleType === "weekly" ? "lesson_series" : "lesson_event", createdId);
  }
  return { status: "success", outcome: "created", message: scheduleType === "weekly" ? `${occurrenceCount} weekly lessons created and added to the calendar.` : "Lesson created and added to the calendar." };
}
