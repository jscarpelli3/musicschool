"use server";

import { createPublicClient } from "@/lib/supabase/public";
import { normalizeE164 } from "@/lib/phone";
import { protectServerAction, RequestBoundaryError } from "@/lib/security/request-boundary";

export type SmsConsentState = { ok: boolean; message: string };

export async function recordSmsConsent(_state: SmsConsentState, formData: FormData): Promise<SmsConsentState> {
  if (String(formData.get("website") ?? "")) return { ok: true, message: "Consent recorded." };
  const fullName = String(formData.get("fullName") ?? "").trim();
  const schoolName = String(formData.get("schoolName") ?? "").trim();
  const phone = normalizeE164(String(formData.get("phone") ?? ""));
  const consented = formData.get("smsConsent") === "yes";
  if (!fullName || fullName.length > 160 || !schoolName || schoolName.length > 160 || !phone || !consented) {
    return { ok: false, message: "Complete every field and check the optional SMS consent box to enroll." };
  }
  try {
    await protectServerAction({ scope: "public.sms-consent", subject: `phone:${phone}`, limit: 5, windowSeconds: 3600, blockSeconds: 3600 });
  } catch (caught) {
    return { ok: false, message: caught instanceof RequestBoundaryError && caught.code === "rate_limited" ? "Too many enrollment attempts were made. Wait an hour and try again." : "This request could not be validated. Reload and try again." };
  }

  const supabase = createPublicClient();
  const { error } = await supabase.rpc("record_public_sms_opt_in", {
    p_full_name: fullName,
    p_phone_e164: phone,
    p_school_name: schoolName,
  });
  if (error) return { ok: false, message: "We could not record your SMS enrollment. Please try again." };
  return { ok: true, message: "You’re enrolled in Common Time transactional messages. Messaging will begin after program activation." };
}
