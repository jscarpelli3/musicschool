"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensurePortalAuthIdentity } from "@/lib/portal/auth-identities";
import { sendResendEmail, ResendRequestError } from "@/lib/resend/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { teacherInvitationEmail } from "@/lib/teachers/invitation-email";
import { normalizeInstrumentNames } from "@/lib/schools/instruments";

type TeacherInviteResult = { ok: boolean; message: string };

export async function setTeacherSelfReschedulePermission(schoolId: string, teacherId: string, formData: FormData) {
  const allowed = formData.get("allowed") === "true";
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_teacher_self_reschedule_permission", {
    p_school_id: schoolId,
    p_teacher_id: teacherId,
    p_allowed: allowed,
  });
  if (error) throw new Error("The teacher permission could not be changed.");
  revalidatePath(`/schools/${schoolId}/staff`);
}

export async function setTeacherSchedulingSettings(schoolId: string, teacherId: string, schedulingAuthority: string, canManageOwnAvailability: boolean, outsideAvailabilityPolicy: string) {
  if (!new Set(["propose_only","manage_assigned_lessons"]).has(schedulingAuthority) || !new Set(["notify_only","require_approval"]).has(outsideAvailabilityPolicy)) return { ok: false, message: "Choose valid scheduling settings." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_teacher_scheduling_settings", {
    p_school_id: schoolId,
    p_teacher_id: teacherId,
    p_scheduling_authority: schedulingAuthority,
    p_can_manage_own_availability: canManageOwnAvailability,
    p_outside_availability_policy: outsideAvailabilityPolicy,
  });
  if (error) return { ok: false, message: error.message.includes("not_authorized") ? "Only the school owner can change teacher scheduling authority." : "The scheduling settings could not be saved. Nothing changed." };
  revalidatePath(`/schools/${schoolId}/staff`);
  revalidatePath(`/schools/${schoolId}/teacher`);
  return { ok: true, message: "Scheduling authority saved." };
}

export async function createAndInviteTeacher(schoolId: string, formData: FormData): Promise<TeacherInviteResult> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const instruments = normalizeInstrumentNames(formData.getAll("instrument").map(String));
  if (!firstName || !lastName || instruments.length === 0) return { ok: false, message: "Complete the teacher details and choose at least one instrument." };
  const supabase = await createClient();
  const { data: teacherId, error } = await supabase.rpc("create_teacher_record", {
    p_school_id: schoolId,
    p_first_name: firstName,
    p_last_name: lastName,
    p_email: email,
    p_instrument_names: instruments,
  });
  if (error || !teacherId) {
    if (error?.message.includes("duplicate_teacher_email")) return { ok: false, message: "That email is already used by another teacher at this school." };
    return { ok: false, message: "The teacher could not be created. Check the details and try again." };
  }
  const result = await deliverTeacherAccess(schoolId, teacherId, email);
  revalidatePath(`/schools/${schoolId}/staff`);
  if (result === "sent") return { ok: true, message: "Teacher created and invitation sent." };
  if (result === "delivery-failed") return { ok: false, message: "The teacher was created, but the invitation email was not sent. Use Resend invitation in the staff roster after the email-provider problem is corrected." };
  if (result === "identity-error") return { ok: false, message: "The teacher was created, but passwordless access could not be prepared. Use Invite teacher in the staff roster to try again." };
  return { ok: false, message: "The teacher was created, but access could not be prepared. Use Invite teacher in the staff roster to try again." };
}

async function deliverTeacherAccess(schoolId: string, teacherId: string, email: string): Promise<"sent" | "invalid" | "identity-error" | "delivery-failed" | "error"> {
  if (!/^[0-9a-f-]{36}$/i.test(schoolId) || !/^[0-9a-f-]{36}$/i.test(teacherId) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 320) return "invalid";
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  const { data: membership } = profileId ? await supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle() : { data: null };
  if (membership?.role !== "owner") return "error";
  let authProfileId: string;
  try {
    authProfileId = await ensurePortalAuthIdentity(email);
  } catch {
    return "identity-error";
  }

  const { data: prepared, error } = await supabase.rpc("prepare_teacher_invitation", {
    p_school_id: schoolId,
    p_teacher_id: teacherId,
    p_profile_id: authProfileId,
    p_email: email,
  });
  const invitation = prepared?.[0];
  if (error || !invitation) {
    return "error";
  }

  const origin = (process.env.APP_URL ?? "https://app.commontime.studio").replace(/\/$/, "");
  const loginUrl = `${origin}/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(`/schools/${schoolId}/teacher`)}`;
  const message = teacherInvitationEmail({ schoolName: invitation.school_name, teacherName: invitation.teacher_name, loginUrl });
  const admin = createAdminClient();
  try {
    const sent = await sendResendEmail({
      from: `${invitation.school_name} via Common Time <notifications@notifications.commontime.studio>`,
      to: email,
      subject: message.subject,
      text: message.text,
      html: message.html,
      idempotencyKey: invitation.idempotency_key,
      messageKind: "teacher_invitation",
    });
    const recorded = await admin.from("teacher_invitation_deliveries").update({ status: "accepted", provider_email_id: sent.id, accepted_at: new Date().toISOString() }).eq("id", invitation.delivery_id).eq("status", "pending").select("id").maybeSingle();
    if (recorded.error || !recorded.data) {
      console.error("Teacher invitation accepted but finalization failed", { deliveryId: invitation.delivery_id, providerEmailId: sent.id, code: recorded.error?.code });
      return "delivery-failed";
    }
  } catch (sendError) {
    const provider = sendError instanceof ResendRequestError ? sendError : null;
    const recorded = await admin.from("teacher_invitation_deliveries").update({ status: "failed", provider_error_code: provider?.code ?? "request_failed", provider_error_message: sendError instanceof Error ? sendError.message.slice(0, 500) : "Provider request failed.", failed_at: new Date().toISOString() }).eq("id", invitation.delivery_id).eq("status", "pending").select("id").maybeSingle();
    if (recorded.error || !recorded.data) console.error("Teacher invitation failure could not be recorded", { deliveryId: invitation.delivery_id, code: recorded.error?.code });
    return "delivery-failed";
  }
  return "sent";
}

export async function inviteTeacherAccess(schoolId: string, teacherId: string, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const result = await deliverTeacherAccess(schoolId, teacherId, email);
  if (result === "invalid") redirect(`/schools/${schoolId}/staff?invite=invalid#staff-status`);
  if (result === "identity-error") redirect(`/schools/${schoolId}/staff?invite=identity-error#staff-status`);
  if (result === "delivery-failed") redirect(`/schools/${schoolId}/staff?invite=delivery-failed#staff-status`);
  if (result !== "sent") redirect(`/schools/${schoolId}/staff?invite=error#staff-status`);
  revalidatePath(`/schools/${schoolId}/staff`);
  redirect(`/schools/${schoolId}/staff?invite=sent#staff-status`);
}

export async function deactivateTeacherAccess(schoolId: string, teacherId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("deactivate_teacher_access", { p_school_id: schoolId, p_teacher_id: teacherId });
  if (error) redirect(`/schools/${schoolId}/staff?access=error`);
  revalidatePath(`/schools/${schoolId}/staff`);
  redirect(`/schools/${schoolId}/staff?access=disabled`);
}
