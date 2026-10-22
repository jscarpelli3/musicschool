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
  const mode = String(formData.get("mode") ?? "stored");
  const label = clean(formData, "label") ?? "Home";
  const addressLine1 = clean(formData, "address_line_1");
  const addressLine2 = clean(formData, "address_line_2");
  const city = clean(formData, "city");
  const region = clean(formData, "region");
  const postalCode = clean(formData, "postal_code");
  const accessNotes = clean(formData, "access_notes");
  if (!['stored', 'arranged_privately'].includes(mode)) return { status: "error", message: "Choose how this home address is managed." };
  if (label.length > 80) return { status: "error", message: "Keep the location label under 80 characters." };
  if (mode === "stored" && (!addressLine1 || !city || !region || !postalCode)) return { status: "error", message: "Add the street, city, state or region, and postal code." };
  if ((addressLine1?.length ?? 0) > 160 || (addressLine2?.length ?? 0) > 160 || (city?.length ?? 0) > 120 || (region?.length ?? 0) > 120 || (postalCode?.length ?? 0) > 24 || (accessNotes?.length ?? 0) > 500) return { status: "error", message: "One or more address fields are too long." };

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
    address_line_1: mode === "stored" ? addressLine1 : null,
    address_line_2: mode === "stored" ? addressLine2 : null,
    city: mode === "stored" ? city : null,
    region: mode === "stored" ? region : null,
    postal_code: mode === "stored" ? postalCode : null,
    access_notes: mode === "stored" ? accessNotes : null,
  };
  const { data: existing } = await supabase.from("family_service_locations").select("id").eq("school_id", schoolId).eq("billing_account_id", billingAccountId).eq("status", "active").maybeSingle();
  const result = existing
    ? await supabase.from("family_service_locations").update(payload).eq("school_id", schoolId).eq("id", existing.id)
    : await supabase.from("family_service_locations").insert({ school_id: schoolId, billing_account_id: billingAccountId, created_by: profileId, ...payload });
  if (result.error) return { status: "error", message: "The protected service location could not be saved. Nothing else changed." };
  revalidatePath(`/schools/${schoolId}/families/${billingAccountId}`);
  revalidatePath(`/schools/${schoolId}`);
  return { status: "success", message: mode === "stored" ? "Home service address saved." : "Home address will be arranged privately." };
}
