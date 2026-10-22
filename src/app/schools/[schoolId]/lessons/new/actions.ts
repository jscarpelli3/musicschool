"use server";

import { revalidatePath } from "next/cache";
import { checkSchoolCapability } from "@/lib/auth/school-capabilities";
import { dispatchLessonCreatedEmail } from "@/lib/notifications/dispatch-lesson-created-email";
import { dispatchLessonRequestEmails } from "@/lib/notifications/dispatch-lesson-request-emails";
import { dispatchLessonProposalEmail } from "@/lib/notifications/dispatch-lesson-proposal-email";
import { protectServerAction, RequestBoundaryError } from "@/lib/security/request-boundary";
import { createClient } from "@/lib/supabase/server";

export type CreateLessonState = {
  status: "idle" | "success" | "error";
  message: string;
  reference?: string;
  outcome?: "created" | "pending_teacher";
  scheduledForToday?: boolean;
  field?: "time";
};

export type CreateLessonPlaceState = {
  status: "success" | "error";
  message: string;
  place?: { id: string; label: string; kind: "school" | "student_home" | "online" | "other" };
};

export type StudentHomeLocationState = "idle" | "checking" | "ready" | "missing" | "ambiguous" | "unavailable";

export async function getStudentHomeLocationState(schoolId: string, studentId: string): Promise<StudentHomeLocationState> {
  if (!/^[0-9a-f-]{36}$/i.test(studentId)) return "unavailable";
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub || !await checkSchoolCapability(supabase, schoolId, "school.lessons.manage")) return "unavailable";
  const { data: links, error: linkError } = await supabase.from("billing_account_students").select("billing_account_id").eq("school_id", schoolId).eq("student_id", studentId);
  if (linkError || !links?.length) return "unavailable";
  const accountIds = links.map((link) => link.billing_account_id);
  const { data: locations, error } = await supabase.from("family_service_locations").select("id").eq("school_id", schoolId).in("billing_account_id", accountIds).eq("status", "active");
  if (error) return "unavailable";
  if ((locations?.length ?? 0) > 1) return "ambiguous";
  return locations?.length === 1 ? "ready" : links.length === 1 ? "missing" : "ambiguous";
}

export async function createLessonPlace(
  schoolId: string,
  formData: FormData,
): Promise<CreateLessonPlaceState> {
  const kind = String(formData.get("kind") ?? "school") as "school" | "student_home" | "online" | "other";
  const submittedName = String(formData.get("name") ?? "").trim();
  const name = kind === "student_home" ? "Student home" : kind === "online" ? "Online" : submittedName;
  const details = kind === "school" ? String(formData.get("details") ?? "").trim() || null : null;
  if (!name || name.length > 120) return { status: "error", message: "Enter a place name up to 120 characters." };
  if (details && details.length > 500) return { status: "error", message: "Place details must be 500 characters or fewer." };
  if (!["school", "student_home", "online"].includes(kind)) return { status: "error", message: "Choose a valid place type." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) return { status: "error", message: "Your session expired. Sign in again before adding a place." };
  if (!await checkSchoolCapability(supabase, schoolId, "school.places.create")) {
    return { status: "error", message: "You do not have permission to add places for this school." };
  }

  if (kind !== "school") {
    const { data: existing } = await supabase.from("lesson_places").select("id,name,kind")
      .eq("school_id", schoolId).eq("kind", kind).eq("status", "active").limit(1).maybeSingle();
    if (existing) return { status: "success", message: `${name} was already available and is now selected.`, place: { id: existing.id, label: name, kind } };
  }

  const { data: place, error } = await supabase.from("lesson_places").insert({
    school_id: schoolId,
    name,
    details,
    kind,
    created_by: profileId,
  }).select("id,name,kind").single();
  if (error || !place) {
    if (error?.code === "23505") {
      const { data: existing } = await supabase.from("lesson_places").select("id,name,kind")
        .eq("school_id", schoolId).eq("name", name).eq("status", "active").maybeSingle();
      if (existing) return { status: "success", message: `${existing.name} was already on the list and is now selected.`, place: { id: existing.id, label: existing.name, kind: existing.kind as "school" | "student_home" | "online" | "other" } };
    }
    return { status: "error", message: "The place could not be added. Your lesson details are still here." };
  }

  revalidatePath(`/schools/${schoolId}`);
  revalidatePath(`/schools/${schoolId}/places`);
  const label = place.kind === "student_home" ? "Student home" : place.kind === "online" ? "Online" : place.name;
  return { status: "success", message: `${label} was added and selected.`, place: { id: place.id, label, kind: place.kind as "school" | "student_home" | "online" | "other" } };
}

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
  student_home_location_required: "Add a protected home lesson location on this student's family record, or mark the address as arranged privately.",
  student_home_location_ambiguous: "This student has more than one active family home. Open the family records and keep only the location intended for lessons.",
  invalid_student_home_location: "The selected home location no longer belongs to this student. Review the family record and try again.",
  lesson_too_far_in_past: "A new lesson cannot be created that far in the past.",
  lesson_start_must_be_future: "Choose a start time in the future. Earlier times today cannot be scheduled.",
  new_lesson_time_must_be_future: "Choose a start time in the future. Earlier times today cannot be scheduled.",
  invalid_recurrence_end: "Choose an end date from the first lesson through one year later.",
  standalone_lesson_requires_per_session_price: "That offering is billed as a recurring agreement. Choose Weekly instead of One time.",
  not_authorized: "Your account does not have permission to create lessons for this school.",
  entitlement_not_found: "That replacement lesson is no longer available.",
  entitlement_already_used: "That replacement lesson has already been scheduled or resolved.",
  entitlement_expired: "That replacement lesson’s scheduling window has expired. Review it with the family before continuing.",
  entitlement_teacher_required: "This replacement lesson must remain with its assigned teacher.",
  entitlement_duration_mismatch: "The original offering’s duration changed. Review the entitlement before scheduling it.",
  entitlement_proposal_pending: "This replacement lesson already has a proposal waiting for a decision.",
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
  const entitlementId = String(formData.get("entitlement_id") ?? "").trim() || undefined;
  const homeStreet = String(formData.get("home_street") ?? "").trim() || undefined;
  const homeCity = String(formData.get("home_city") ?? "").trim() || undefined;

  if (![schoolId, productId, teacherId, studentId, placeId].every((value) => /^[0-9a-f-]{36}$/i.test(value))
      || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)
      || !["one_time", "weekly"].includes(scheduleType)
      || (scheduleType === "weekly" && !/^\d{4}-\d{2}-\d{2}$/.test(endsOn))
      || Number(time.slice(3)) % 5 !== 0
      || (entitlementId !== undefined && !/^[0-9a-f-]{36}$/i.test(entitlementId))
      || (entitlementId !== undefined && scheduleType !== "one_time")
      || (notes?.length ?? 0) > 1000 || (outsideNote?.length ?? 0) > 240
      || (homeStreet?.length ?? 0) > 160 || (homeCity?.length ?? 0) > 120) {
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

  if (!await checkSchoolCapability(supabase, schoolId, "school.lessons.manage")) {
    return { status: "error", message: knownErrors.not_authorized };
  }

  const [{ data: school }, { data: product }, { data: teacherPolicy }, { data: rules }, { data: place }] = await Promise.all([
    supabase.from("schools").select("timezone").eq("id", schoolId).maybeSingle(),
    supabase.from("service_products").select("duration_minutes").eq("school_id", schoolId).eq("id", productId).eq("status", "active").maybeSingle(),
    supabase.from("teachers").select("outside_availability_policy").eq("school_id", schoolId).eq("person_id", teacherId).maybeSingle(),
    supabase.from("teacher_availability_rules").select("weekday,start_time,end_time,effective_from,effective_until").eq("school_id", schoolId).eq("teacher_id", teacherId),
    supabase.from("lesson_places").select("kind").eq("school_id", schoolId).eq("id", placeId).eq("status", "active").maybeSingle(),
  ]);
  if (!school || !product || !teacherPolicy || !place) return { status: "error", message: "The teacher’s scheduling policy or lesson place could not be verified. Nothing was added; reload and try again." };
  if (place.kind === "student_home") {
    const { data: accountLinks } = await supabase.from("billing_account_students").select("billing_account_id").eq("school_id", schoolId).eq("student_id", studentId);
    const accountIds = (accountLinks ?? []).map((link) => link.billing_account_id);
    const { data: homeLocations } = accountIds.length ? await supabase.from("family_service_locations").select("id").eq("school_id", schoolId).in("billing_account_id", accountIds).eq("status", "active") : { data: [] };
    if ((homeLocations?.length ?? 0) > 1 || (!homeLocations?.length && accountIds.length !== 1)) return { status: "error", message: knownErrors.student_home_location_ambiguous };
    if (!homeLocations?.length) {
      if (!homeStreet || !homeCity) return { status: "error", message: "Add the family’s street address and city for this in-home lesson." };
      if (!await checkSchoolCapability(supabase, schoolId, "school.billing.manage")) return { status: "error", message: "You do not have permission to save this family’s protected home address." };
      const { error: locationError } = await supabase.from("family_service_locations").insert({
        school_id: schoolId,
        billing_account_id: accountIds[0],
        created_by: profileId,
        mode: "stored",
        label: "Home",
        address_line_1: homeStreet,
        city: homeCity,
      });
      if (locationError) return { status: "error", message: "The home address could not be saved, so the lesson was not created." };
    }
  }
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
  const schoolToday = new Intl.DateTimeFormat("en-CA", { timeZone: school.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const scheduledForToday = date === schoolToday;
  const overrideReason = allowOutside ? outsideNote ?? "Owner scheduled outside the teacher’s saved availability." : undefined;

  if (allowOutside && teacherPolicy.outside_availability_policy === "require_approval") {
    const { data: proposalId, error: proposalError } = entitlementId
      ? await supabase.rpc("create_outside_availability_entitlement_proposal", {
          p_school_id: schoolId, p_entitlement_id: entitlementId, p_teacher_id: teacherId, p_place_id: placeId,
          p_local_start: `${date} ${time}:00`, p_notes: notes ?? "", p_reason: overrideReason!,
        })
      : await supabase.rpc("create_outside_availability_lesson_proposal", {
          p_school_id: schoolId, p_product_id: productId, p_teacher_id: teacherId, p_student_id: studentId, p_place_id: placeId,
          p_local_start: `${date} ${time}:00`, p_schedule_type: scheduleType, p_ends_on: scheduleType === "weekly" ? endsOn : date,
          p_notes: notes ?? "", p_reason: overrideReason!,
        });
    if (proposalError || !proposalId) {
      const knownCode = Object.keys(knownErrors).find((code) => proposalError?.message.includes(code));
      const reference = crypto.randomUUID().slice(0, 8).toUpperCase();
      console.error("Lesson approval proposal failure", { reference, schoolId, teacherId, code: proposalError?.code, message: proposalError?.message });
      return { status: "error", message: knownCode ? knownErrors[knownCode] : `The approval request could not be created. Nothing was added, so it is safe to try again. Reference ${reference}.`, reference, field: knownCode?.includes("future") ? "time" : undefined };
    }
    await dispatchLessonProposalEmail(proposalId);
    revalidatePath(`/schools/${schoolId}/teacher`);
    return { status: "success", outcome: "pending_teacher", scheduledForToday, message: scheduledForToday ? "Approval requested for a lesson later today. It will be added only if the teacher accepts." : "Approval requested. The lesson will be added only if the teacher accepts." };
  }

  const result = entitlementId
    ? await supabase.rpc("schedule_service_entitlement", {
        p_school_id: schoolId, p_entitlement_id: entitlementId, p_teacher_id: teacherId, p_place_id: placeId,
        p_local_start: `${date} ${time}:00`, p_notes: notes,
        p_allow_outside_availability: allowOutside, p_override_reason: overrideReason,
      })
    : scheduleType === "weekly"
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
    if (knownCode) return { status: "error", message: knownErrors[knownCode], field: knownCode.includes("future") || knownCode.includes("lesson_start") ? "time" : undefined };
    const reference = crypto.randomUUID().slice(0, 8).toUpperCase();
    console.error("Unexpected lesson creation failure", { reference, schoolId, teacherId, code: error?.code });
    return {
      status: "error",
      message: `The lesson could not be created. Nothing was added, so it is safe to try again. Reference ${reference}.`,
      reference,
    };
  }

  revalidatePath(`/schools/${schoolId}`);
  revalidatePath(`/schools/${schoolId}/approvals`);
  revalidatePath(`/schools/${schoolId}/notifications`);
  revalidatePath(`/schools/${schoolId}/teacher`);
  revalidatePath(`/schools/${schoolId}/staff/${teacherId}`);
  revalidatePath(`/schools/${schoolId}/students/${studentId}`);
  const occurrenceCount = scheduleType === "weekly" && typeof createdRecord === "object" && createdRecord !== null && !Array.isArray(createdRecord)
    ? Number((createdRecord as Record<string, unknown>).occurrence_count ?? 0)
    : 1;
  const createdId = scheduleType === "weekly" && typeof createdRecord === "object" && createdRecord !== null && !Array.isArray(createdRecord)
    ? String((createdRecord as Record<string, unknown>).series_id ?? "")
    : String(createdRecord);
  if (/^[0-9a-f-]{36}$/i.test(createdId)) {
    await dispatchLessonCreatedEmail(scheduleType === "weekly" ? "lesson_series" : "lesson_event", createdId);
  }
  if (entitlementId) {
    const { data: entitlement } = await supabase.from("lesson_service_entitlements").select("source_request_id").eq("school_id", schoolId).eq("id", entitlementId).maybeSingle();
    if (entitlement?.source_request_id) await dispatchLessonRequestEmails(entitlement.source_request_id);
  }
  return { status: "success", outcome: "created", scheduledForToday, message: entitlementId ? "Replacement lesson scheduled. This entitlement cannot be used again." : scheduleType === "weekly" ? `${occurrenceCount} weekly lessons created and added to the calendar.` : scheduledForToday ? "Lesson created for later today. Confirm the teacher and family expect this short-notice addition." : "Lesson created and added to the calendar." };
}
