"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensurePortalAuthIdentity } from "@/lib/portal/auth-identities";
import { sendResendEmail, ResendRequestError } from "@/lib/resend/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { teacherInvitationEmail } from "@/lib/teachers/invitation-email";

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

export async function createAndInviteTeacher(schoolId: string, formData: FormData) {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const defaultMinutes = Number(formData.get("default_lesson_minutes") ?? 30);
  if (!firstName || !lastName || !Number.isInteger(defaultMinutes)) redirect(`/schools/${schoolId}/staff?invite=invalid`);
  const supabase = await createClient();
  const { data: teacherId, error } = await supabase.rpc("create_teacher_record", {
    p_school_id: schoolId,
    p_first_name: firstName,
    p_last_name: lastName,
    p_email: email,
    p_default_lesson_minutes: defaultMinutes,
  });
  if (error || !teacherId) {
    if (error?.message.includes("duplicate_teacher_email")) redirect(`/schools/${schoolId}/staff?invite=duplicate`);
    redirect(`/schools/${schoolId}/staff?invite=error`);
  }
  await inviteTeacherAccess(schoolId, teacherId, formData);
}

export async function inviteTeacherAccess(schoolId: string, teacherId: string, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[0-9a-f-]{36}$/i.test(schoolId) || !/^[0-9a-f-]{36}$/i.test(teacherId) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 320) redirect(`/schools/${schoolId}/staff?invite=invalid`);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  const { data: membership } = profileId ? await supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle() : { data: null };
  if (membership?.role !== "owner") redirect(`/schools/${schoolId}`);
  let authProfileId: string;
  try {
    authProfileId = await ensurePortalAuthIdentity(email);
  } catch {
    redirect(`/schools/${schoolId}/staff?invite=identity-error`);
  }

  const { data: prepared, error } = await supabase.rpc("prepare_teacher_invitation", {
    p_school_id: schoolId,
    p_teacher_id: teacherId,
    p_profile_id: authProfileId,
    p_email: email,
  });
  const invitation = prepared?.[0];
  if (error || !invitation) {
    if (error?.message.includes("duplicate_teacher_email")) redirect(`/schools/${schoolId}/staff?invite=duplicate`);
    redirect(`/schools/${schoolId}/staff?invite=error`);
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
    await admin.from("teacher_invitation_deliveries").update({ status: "accepted", provider_email_id: sent.id, accepted_at: new Date().toISOString() }).eq("id", invitation.delivery_id).eq("status", "pending");
  } catch (sendError) {
    const provider = sendError instanceof ResendRequestError ? sendError : null;
    await admin.from("teacher_invitation_deliveries").update({ status: "failed", provider_error_code: provider?.code ?? "request_failed", provider_error_message: sendError instanceof Error ? sendError.message.slice(0, 500) : "Provider request failed.", failed_at: new Date().toISOString() }).eq("id", invitation.delivery_id).eq("status", "pending");
    redirect(`/schools/${schoolId}/staff?invite=delivery-failed`);
  }
  revalidatePath(`/schools/${schoolId}/staff`);
  redirect(`/schools/${schoolId}/staff?invite=sent`);
}

export async function deactivateTeacherAccess(schoolId: string, teacherId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("deactivate_teacher_access", { p_school_id: schoolId, p_teacher_id: teacherId });
  if (error) redirect(`/schools/${schoolId}/staff?access=error`);
  revalidatePath(`/schools/${schoolId}/staff`);
  redirect(`/schools/${schoolId}/staff?access=disabled`);
}
