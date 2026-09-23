"use server";

import { revalidatePath } from "next/cache";
import { ensurePortalAuthIdentity } from "@/lib/portal/auth-identities";
import { protectServerAction } from "@/lib/security/request-boundary";
import { createClient } from "@/lib/supabase/server";
import { loadMySchoolCapabilities } from "@/lib/auth/school-capabilities";

export type AddFamilyState = { ok: boolean; message: string };

export async function addStudentAndPayer(schoolId: string, _state: AddFamilyState, formData: FormData): Promise<AddFamilyState> {
  const values = {
    studentFirst: String(formData.get("student_first") ?? "").trim(),
    studentLast: String(formData.get("student_last") ?? "").trim(),
    payerFirst: String(formData.get("payer_first") ?? "").trim(),
    payerLast: String(formData.get("payer_last") ?? "").trim(),
    email: String(formData.get("payer_email") ?? "").trim().toLowerCase(),
    relationship: String(formData.get("relationship") ?? "parent").trim(),
    operationId: String(formData.get("operation_id") ?? "").trim(),
  };
  if (Object.values(values).some((value) => !value) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(values.operationId)) return { ok: false, message: "Complete the student and payer details, including a valid email address." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) return { ok: false, message: "Your session expired. Sign in again." };
  try {
    await protectServerAction({ scope: "school.add_student_and_payer", subject: `actor:${profileId}|school:${schoolId}`, limit: 12, windowSeconds: 3600 });
    const capabilities = await loadMySchoolCapabilities(schoolId);
    if (!capabilities.has("school.billing.manage")) return { ok: false, message: "You do not have permission to add families at this school." };
    const payerProfileId = await ensurePortalAuthIdentity(values.email);
    const { error } = await supabase.rpc("create_student_and_payer", { p_school_id: schoolId, p_student_first_name: values.studentFirst, p_student_last_name: values.studentLast, p_payer_first_name: values.payerFirst, p_payer_last_name: values.payerLast, p_payer_email: values.email, p_payer_profile_id: payerProfileId, p_relationship: values.relationship, p_operation_id: values.operationId });
    if (error) return { ok: false, message: "The student and payer could not be saved. Nothing was partially created; check the details and try again." };
    revalidatePath(`/schools/${schoolId}`);
    revalidatePath(`/schools/${schoolId}/students`);
    revalidatePath(`/schools/${schoolId}/families`);
    revalidatePath(`/schools/${schoolId}/onboarding`);
    return { ok: true, message: "Student and payer added." };
  } catch {
    return { ok: false, message: "The student and payer could not be prepared. Nothing was partially created; try again." };
  }
}
