"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateSchoolInfo(schoolId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const addressLine1 = String(formData.get("address_line_1") ?? "").trim() || null;
  const addressLine2 = String(formData.get("address_line_2") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const region = String(formData.get("region") ?? "").trim() || null;
  const postalCode = String(formData.get("postal_code") ?? "").trim() || null;

  if (!name || name.length > 120) redirect(`/schools/${schoolId}/setup?status=invalid`);
  if ([phone, addressLine1, addressLine2, city, region, postalCode].some((value) => value && value.length > 160)) {
    redirect(`/schools/${schoolId}/setup?status=invalid`);
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(`/login?next=/schools/${schoolId}/setup`);

  const { data: updated, error } = await supabase.from("schools").update({
    name,
    phone,
    address_line_1: addressLine1,
    address_line_2: addressLine2,
    city,
    region,
    postal_code: postalCode,
  }).eq("id", schoolId).select("id").maybeSingle();

  if (error || !updated) redirect(`/schools/${schoolId}/setup?status=error`);
  revalidatePath(`/schools/${schoolId}`);
  revalidatePath(`/schools/${schoolId}/setup`);
  redirect(`/schools/${schoolId}/setup?status=saved`);
}
