"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkSchoolCapability } from "@/lib/auth/school-capabilities";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSchoolThemeKey } from "@/lib/ui/school-themes";
import { isSchoolFontKey } from "@/lib/ui/school-fonts";

export async function updateSchoolTheme(schoolId: string, formData: FormData) {
  const themeKey = String(formData.get("theme_key") ?? "");
  if (!isSchoolThemeKey(themeKey)) redirect(`/schools/${schoolId}/appearance?status=invalid`);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/appearance`);
  if (!await checkSchoolCapability(supabase, schoolId, "school.appearance.palette_manage")) redirect(`/schools/${schoolId}`);

  const { data: updated, error } = await supabase.from("schools").update({ theme_key: themeKey }).eq("id", schoolId).select("id").maybeSingle();
  if (error || !updated) redirect(`/schools/${schoolId}/appearance?status=error`);
  revalidatePath(`/schools/${schoolId}`);
  revalidatePath(`/schools/${schoolId}/appearance`);
  redirect(`/schools/${schoolId}/appearance?status=saved`);
}

export async function updateSchoolFont(schoolId: string, formData: FormData) {
  const fontKey = String(formData.get("font_key") ?? "");
  if (!isSchoolFontKey(fontKey)) redirect(`/schools/${schoolId}/appearance?type=font&status=invalid`);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect(`/login?next=/schools/${schoolId}/appearance`);
  if (!await checkSchoolCapability(supabase, schoolId, "school.appearance.palette_manage")) redirect(`/schools/${schoolId}`);
  const { data: updated, error } = await supabase.from("schools").update({ font_key: fontKey }).eq("id", schoolId).select("id").maybeSingle();
  if (error || !updated) redirect(`/schools/${schoolId}/appearance?type=font&status=error`);
  revalidatePath(`/schools/${schoolId}`);
  revalidatePath(`/schools/${schoolId}/appearance`);
  redirect(`/schools/${schoolId}/appearance?type=font&status=saved`);
}

export type SchoolInfoField = "name" | "reply_to_email" | "phone" | "address_line_1" | "address_line_2" | "city" | "region" | "postal_code";
export type SchoolInfoState = { ok: boolean; message: string; fieldErrors: Partial<Record<SchoolInfoField, string>> };

export async function updateSchoolInfo(schoolId: string, _previous: SchoolInfoState, formData: FormData): Promise<SchoolInfoState> {
  void _previous;
  const destination = `/schools/${schoolId}/setup`;
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const replyToEmail = String(formData.get("reply_to_email") ?? "").trim().toLowerCase() || null;
  const addressLine1 = String(formData.get("address_line_1") ?? "").trim() || null;
  const addressLine2 = String(formData.get("address_line_2") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const region = String(formData.get("region") ?? "").trim() || null;
  const postalCode = String(formData.get("postal_code") ?? "").trim() || null;

  const fieldErrors: SchoolInfoState["fieldErrors"] = {};
  if (!name) fieldErrors.name = "Enter the name families and teachers should see.";
  else if (name.length > 120) fieldErrors.name = "Keep the school name to 120 characters or fewer.";
  if (replyToEmail && (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(replyToEmail) || replyToEmail.length > 320)) fieldErrors.reply_to_email = "Enter a complete email address, such as name@example.com, or leave this blank.";
  const optionalFields: Array<[SchoolInfoField, string | null, string]> = [
    ["phone", phone, "Phone number"], ["address_line_1", addressLine1, "Address"], ["address_line_2", addressLine2, "Suite or unit"],
    ["city", city, "City"], ["region", region, "State or region"], ["postal_code", postalCode, "Postal code"],
  ];
  for (const [field, value, label] of optionalFields) if (value && value.length > 160) fieldErrors[field] = `${label} must be 160 characters or fewer.`;
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Review the highlighted information, then save again.", fieldErrors };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(`/login?next=${encodeURIComponent(destination)}`);
  if (!await checkSchoolCapability(supabase, schoolId, "school.setup.manage")) return { ok: false, message: "Your account does not have permission to change this school’s information.", fieldErrors: {} };

  const { data: current, error: currentError } = await supabase.from("schools")
    .select("name,phone,reply_to_email,address_line_1,address_line_2,city,region,postal_code").eq("id", schoolId).maybeSingle();
  if (currentError || !current) {
    console.error("School information lookup failed", { schoolId, code: currentError?.code ?? "no_row" });
    return { ok: false, message: "We could not open the current school record. Refresh the page and try again.", fieldErrors: {} };
  }

  const next = { name, phone, reply_to_email: replyToEmail, address_line_1: addressLine1, address_line_2: addressLine2, city, region, postal_code: postalCode };
  const changedFields = (Object.keys(next) as Array<keyof typeof next>).filter((field) => current[field] !== next[field]);
  if (!changedFields.length) return { ok: true, message: "Everything is already up to date.", fieldErrors: {} };

  const { data: updated, error } = await supabase.from("schools").update(next).eq("id", schoolId).select("id").maybeSingle();

  if (error || !updated) {
    console.error("School information update failed", { schoolId, code: error?.code ?? "no_row" });
    return { ok: false, message: "The school record was not changed. Check your connection, then try saving again.", fieldErrors: {} };
  }
  const { error: auditError } = await createAdminClient().from("audit_log").insert({ school_id: schoolId, actor_profile_id: data.claims.sub, action: "school.info_updated", entity_type: "school", entity_id: schoolId, metadata: { changed_fields: changedFields } });
  if (auditError) console.error("School information audit write failed", { schoolId, code: auditError.code });
  revalidatePath(`/schools/${schoolId}`);
  revalidatePath(`/schools/${schoolId}/setup`);
  revalidatePath(`/schools/${schoolId}/onboarding`);
  return { ok: true, message: "School information saved.", fieldErrors: {} };
}
