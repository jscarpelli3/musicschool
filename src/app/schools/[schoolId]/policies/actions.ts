"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CancellationPolicyState = { ok: boolean; message: string };

const integer = (formData: FormData, key: string) => {
  const raw = String(formData.get(key) ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
};

export async function publishCancellationPolicy(
  schoolId: string,
  _previous: CancellationPolicyState,
  formData: FormData,
): Promise<CancellationPolicyState> {
  const name = String(formData.get("name") ?? "").trim();
  const cancelCutoff = integer(formData, "cancel_cutoff_hours");
  const rescheduleCutoff = integer(formData, "reschedule_cutoff_hours");
  const timelyDisposition = String(formData.get("timely_disposition") ?? "");
  const lateResolution = String(formData.get("late_lesson_resolution") ?? "");
  const feeDollars = integer(formData, "late_reschedule_fee_dollars");
  const replacementWindow = integer(formData, "replacement_window_days");
  const timelyGuidance = String(formData.get("timely_guidance") ?? "").trim();
  const lateGuidance = String(formData.get("late_guidance") ?? "").trim();

  if (!name || cancelCutoff === null || rescheduleCutoff === null || feeDollars === null || replacementWindow === null || !timelyGuidance || !lateGuidance) {
    return { ok: false, message: "Complete each policy field before publishing." };
  }
  if (cancelCutoff > 8760 || rescheduleCutoff > 8760 || replacementWindow > 365 || feeDollars > 10000) {
    return { ok: false, message: "One of the policy values is outside the allowed range." };
  }
  if (lateResolution !== "retain_for_reschedule" && feeDollars !== 0) {
    return { ok: false, message: "A late-change fee can only be used when the lesson remains available to reschedule." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) return { ok: false, message: "Your session expired. Sign in and try again." };
  const { data: membership } = await supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) return { ok: false, message: "You do not have permission to publish this policy." };

  const { error } = await supabase.rpc("publish_default_cancellation_policy", {
    p_school_id: schoolId,
    p_name: name,
    p_cancel_cutoff_hours: cancelCutoff,
    p_reschedule_cutoff_hours: rescheduleCutoff,
    p_timely_disposition: timelyDisposition,
    p_late_lesson_resolution: lateResolution,
    p_late_reschedule_fee_cents: feeDollars * 100,
    p_replacement_window_days: replacementWindow,
    p_must_keep_assigned_teacher: formData.get("must_keep_assigned_teacher") === "on",
    p_timely_guidance: timelyGuidance,
    p_late_guidance: lateGuidance,
  });
  if (error) {
    console.error("publish_cancellation_policy_failed", { schoolId, code: error.code });
    return { ok: false, message: "The policy was not published. Nothing changed, so it is safe to try again." };
  }
  revalidatePath(`/schools/${schoolId}/policies`);
  return { ok: true, message: "Cancellation policy published. Future requests will use this version." };
}

export async function saveFamilyCancellationAccess(
  schoolId:string,_previous:CancellationPolicyState,formData:FormData,
):Promise<CancellationPolicyState>{
  const timelyApprovalMode=String(formData.get("timely_approval_mode")??"");
  const refundPortalMode=String(formData.get("refund_portal_mode")??"");
  if(timelyApprovalMode!=="owner_review"||!["contact_school","not_offered"].includes(refundPortalMode))return{ok:false,message:"That setting is not available until its complete transaction and notification workflow is active."};
  const supabase=await createClient();
  const {data:auth}=await supabase.auth.getClaims();
  if(!auth?.claims?.sub)return{ok:false,message:"Your session expired. Sign in and try again."};
  const {error}=await supabase.rpc("set_school_family_cancellation_settings",{p_school_id:schoolId,p_timely_approval_mode:timelyApprovalMode,p_refund_portal_mode:refundPortalMode});
  if(error){console.error("save_family_cancellation_access_failed",{schoolId,code:error.code});return{ok:false,message:"These family cancellation settings were not saved. Nothing changed, so it is safe to try again."};}
  revalidatePath(`/schools/${schoolId}/policies`);revalidatePath("/portal");
  return{ok:true,message:"Family cancellation access updated."};
}
