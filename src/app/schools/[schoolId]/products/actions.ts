"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ProductState = { error: string | null };

function integer(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isInteger(value) ? value : null;
}

function cents(value: FormDataEntryValue | null) {
  const input = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(input)) return null;
  return Math.round(Number(input) * 100);
}

export async function createProduct(
  schoolId: string,
  _state: ProductState,
  formData: FormData,
): Promise<ProductState> {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const format = String(formData.get("format"));
  const durationMinutes = integer(formData, "duration_minutes");
  const sessionsPerInterval = integer(formData, "sessions_per_interval");
  const intervalCount = integer(formData, "interval_count");
  const intervalUnit = String(formData.get("interval_unit"));
  const pricingModel = String(formData.get("pricing_model"));
  const priceCents = cents(formData.get("price"));
  const requestedCapacity = integer(formData, "capacity");
  const capacity = format === "private_lesson" ? 1 : requestedCapacity;

  if (!name || name.length > 120) return { error: "Enter a product name up to 120 characters." };
  if (!(["private_lesson", "group_class"] as string[]).includes(format)) return { error: "Choose a valid format." };
  if (!durationMinutes || durationMinutes < 15 || durationMinutes > 480) return { error: "Duration must be between 15 and 480 minutes." };
  if (!sessionsPerInterval || sessionsPerInterval < 1 || sessionsPerInterval > 31) return { error: "Enter between 1 and 31 sessions per interval." };
  if (!intervalCount || intervalCount < 1 || intervalCount > 12) return { error: "The interval must be between 1 and 12 weeks or months." };
  if (!(["week", "month"] as string[]).includes(intervalUnit)) return { error: "Choose weeks or months." };
  if (!(["fixed_monthly", "per_session"] as string[]).includes(pricingModel)) return { error: "Choose a valid pricing model." };
  if (priceCents === null) return { error: "Enter a valid price with no more than two decimal places." };
  if (!capacity || capacity < 1 || capacity > 500) return { error: "Class capacity must be between 2 and 500." };

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const profileId = authData?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/products`);

  const { data: school } = await supabase
    .from("schools")
    .select("currency")
    .eq("id", schoolId)
    .maybeSingle();
  if (!school) return { error: "School not found or you do not have access." };

  const { error } = await supabase.from("service_products").insert({
    school_id: schoolId,
    name,
    description,
    format,
    duration_minutes: durationMinutes,
    sessions_per_interval: sessionsPerInterval,
    interval_count: intervalCount,
    interval_unit: intervalUnit,
    pricing_model: pricingModel,
    price_cents: priceCents,
    currency: school.currency,
    capacity,
    created_by: profileId,
  });

  if (error) {
    return { error: error.code === "23505" ? "A product with this name already exists." : error.message };
  }

  revalidatePath(`/schools/${schoolId}/products`);
  redirect(`/schools/${schoolId}/products?created=1`);
}

export async function archiveProduct(schoolId: string, productId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(`/login?next=/schools/${schoolId}/products`);

  await supabase
    .from("service_products")
    .update({ status: "archived" })
    .eq("id", productId)
    .eq("school_id", schoolId);

  revalidatePath(`/schools/${schoolId}/products`);
}
