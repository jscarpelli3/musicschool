"use server";

import { revalidatePath } from "next/cache";
import { checkSchoolCapability } from "@/lib/auth/school-capabilities";
import { createClient } from "@/lib/supabase/server";

export type ServiceLocationState = { status: "idle" | "success" | "error"; message: string };

const clean = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim() || null;

export async function saveFamilyServiceLocation(
  schoolId: string,
  billingAccountId: string,
  _state: ServiceLocationState,
  formData: FormData,
): Promise<ServiceLocationState> {
  const mode = "stored";
  const label = "Home";
  const addressLine1 = clean(formData, "address_line_1");
  const city = clean(formData, "city");
  if (!addressLine1 || !city) return { status: "error", message: "Add the street address and city." };
  if (addressLine1.length > 160 || city.length > 120) return { status: "error", message: "One or more address fields are too long." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) return { status: "error", message: "Your session expired. Sign in again." };
  if (!await checkSchoolCapability(supabase, schoolId, "school.billing.manage")) return { status: "error", message: "You do not have permission to manage protected family addresses." };
  const { data: account } = await supabase.from("billing_accounts").select("id").eq("school_id", schoolId).eq("id", billingAccountId).maybeSingle();
  if (!account) return { status: "error", message: "That family account is no longer available." };

  const payload = {
    mode,
    label,
    address_line_1: addressLine1,
    address_line_2: null,
    city,
    region: null,
    postal_code: null,
    access_notes: null,
  };
  const { data: existing } = await supabase.from("family_service_locations").select("id").eq("school_id", schoolId).eq("billing_account_id", billingAccountId).eq("status", "active").maybeSingle();
  const result = existing
    ? await supabase.from("family_service_locations").update(payload).eq("school_id", schoolId).eq("id", existing.id)
    : await supabase.from("family_service_locations").insert({ school_id: schoolId, billing_account_id: billingAccountId, created_by: profileId, ...payload });
  if (result.error) return { status: "error", message: "The protected service location could not be saved. Nothing else changed." };
  revalidatePath(`/schools/${schoolId}/families/${billingAccountId}`);
  revalidatePath(`/schools/${schoolId}`);
  return { status: "success", message: "Home address saved." };
}

export async function retireFamilyServiceLocation(schoolId: string, billingAccountId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) return { ok: false, message: "Your session expired. Sign in again." };
  if (!await checkSchoolCapability(supabase, schoolId, "school.billing.manage")) return { ok: false, message: "You do not have permission to remove protected family addresses." };
  const { data, error } = await supabase.rpc("retire_family_service_location", { p_school_id: schoolId, p_billing_account_id: billingAccountId });
  if (error?.message.includes("home_lessons_pending")) return { ok: false, message: "This address is still attached to an upcoming home lesson. Change that lesson’s place before removing it." };
  if (error) return { ok: false, message: "The stored address could not be removed. Nothing changed." };
  revalidatePath(`/schools/${schoolId}/families/${billingAccountId}`);
  revalidatePath(`/schools/${schoolId}`);
  return { ok: true, message: data === "already_removed" ? "No active home address remains on this family." : "The stored address was removed." };
}
