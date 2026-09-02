"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStripe, getStripeMode } from "@/lib/stripe/server";

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
  const billingTiming = String(formData.get("billing_timing"));
  const priceCents = cents(formData.get("price"));
  const requestedCapacity = integer(formData, "capacity");
  const capacity = format === "private_lesson" ? 1 : requestedCapacity;

  if (!name || name.length > 120) return { error: "Enter an offering name up to 120 characters." };
  if (!(["private_lesson", "group_class"] as string[]).includes(format)) return { error: "Choose a valid format." };
  if (!durationMinutes || durationMinutes < 15 || durationMinutes > 480) return { error: "Duration must be between 15 and 480 minutes." };
  if (!sessionsPerInterval || sessionsPerInterval < 1 || sessionsPerInterval > 31) return { error: "Enter between 1 and 31 sessions per interval." };
  if (!intervalCount || intervalCount < 1 || intervalCount > 12) return { error: "The interval must be between 1 and 12 weeks or months." };
  if (!(["week", "month"] as string[]).includes(intervalUnit)) return { error: "Choose weeks or months." };
  if (!(["fixed_monthly", "per_session"] as string[]).includes(pricingModel)) return { error: "Choose a valid pricing model." };
  if (priceCents === null) return { error: "Enter a valid price with no more than two decimal places." };
  if (!capacity || capacity < 1 || capacity > 500) return { error: "Class capacity must be between 2 and 500." };
  if (!(["school_default", "before_service", "after_service"] as string[]).includes(billingTiming)) return { error: "Choose when this offering is billed." };

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const profileId = authData?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/products`);

  const livemode = getStripeMode() === "live";
  const [{ data: school }, { data: membership }, { data: connection }] = await Promise.all([
    supabase.from("schools").select("currency").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("school_payment_connections").select("provider_account_id,status,charges_enabled")
      .eq("school_id", schoolId).eq("provider", "stripe").eq("livemode", livemode).maybeSingle(),
  ]);
  if (!school || !membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "School not found or you do not have access." };
  }
  if (!connection?.provider_account_id || connection.status !== "enabled" || !connection.charges_enabled) {
    return { error: "Finish connecting Stripe before creating a priced offering." };
  }

  const admin = createAdminClient();
  const requestSnapshot = {
    name, description, format, duration_minutes: durationMinutes,
    sessions_per_interval: sessionsPerInterval, interval_count: intervalCount,
    interval_unit: intervalUnit, pricing_model: pricingModel,
    billing_timing_override: billingTiming === "school_default" ? null : billingTiming,
    requested_price_cents: priceCents, currency: school.currency, capacity,
  };
  const { data: operation, error: operationError } = await admin.from("stripe_catalog_operations").insert({
    school_id: schoolId,
    actor_profile_id: profileId,
    operation: "create_offering",
    status: "prepared",
    request_snapshot: requestSnapshot,
    provider_account_id: connection.provider_account_id,
  }).select("id").single();
  if (operationError || !operation) return { error: "The offering could not be prepared. Nothing was sent to Stripe." };

  const stripe = getStripe();
  let providerProductId: string | null = null;
  let providerPriceId: string | null = null;
  try {
    await admin.from("stripe_catalog_operations").update({ status: "submitting" }).eq("id", operation.id);
    const providerProduct = await stripe.products.create({
      name,
      description: description ?? undefined,
      metadata: { commontime_school_id: schoolId, commontime_operation_id: operation.id },
    }, { stripeAccount: connection.provider_account_id, idempotencyKey: `catalog-product-${operation.id}` });
    providerProductId = providerProduct.id;
    const providerPrice = await stripe.prices.create({
      product: providerProduct.id,
      currency: school.currency.toLowerCase(),
      unit_amount: priceCents,
      metadata: { commontime_school_id: schoolId, commontime_operation_id: operation.id },
    }, { stripeAccount: connection.provider_account_id, idempotencyKey: `catalog-price-${operation.id}` });
    if (providerPrice.unit_amount !== priceCents || providerPrice.currency.toUpperCase() !== school.currency) {
      throw new Error("Stripe returned a price that did not match the authorized request.");
    }
    providerPriceId = providerPrice.id;

    const { data: localProduct, error: localError } = await admin.from("service_products").insert({
      school_id: schoolId,
      name,
      description,
      format,
      duration_minutes: durationMinutes,
      sessions_per_interval: sessionsPerInterval,
      interval_count: intervalCount,
      interval_unit: intervalUnit,
      pricing_model: pricingModel,
      billing_timing_override: billingTiming === "school_default" ? null : billingTiming,
      currency: school.currency,
      capacity,
      price_cents: providerPrice.unit_amount,
      created_by: profileId,
      stripe_account_id: connection.provider_account_id,
      stripe_product_id: providerProduct.id,
      stripe_price_id: providerPrice.id,
      stripe_sync_status: "synced",
    }).select("id").single();
    if (localError || !localProduct) throw localError ?? new Error("The Stripe offering was not finalized locally.");
    const { error: finalizeError } = await admin.from("stripe_catalog_operations").update({
      status: "succeeded", provider_product_id: providerProduct.id, provider_price_id: providerPrice.id,
      service_product_id: localProduct.id, completed_at: new Date().toISOString(),
    }).eq("id", operation.id);
    if (finalizeError) throw finalizeError;
  } catch (error) {
    const providerMayHaveAccepted = Boolean(providerProductId || providerPriceId);
    await admin.from("stripe_catalog_operations").update({
      status: providerMayHaveAccepted ? "reconciliation_required" : "failed",
      provider_product_id: providerProductId,
      provider_price_id: providerPriceId,
      error_class: providerMayHaveAccepted ? "provider_state_ambiguous" : "provider_rejected",
      error_message: error instanceof Error ? error.message.slice(0, 500) : "Unknown catalog error",
      completed_at: new Date().toISOString(),
    }).eq("id", operation.id);
    return { error: providerMayHaveAccepted
      ? `Stripe may have received this offering, but Common Time could not finish saving it. Do not retry yet. Reference ${operation.id.slice(0, 8).toUpperCase()}.`
      : "Stripe did not create the offering. Nothing was saved, so it is safe to try again." };
  }

  revalidatePath(`/schools/${schoolId}/products`);
  redirect(`/schools/${schoolId}/products?created=1`);
}

export async function updateSchoolBillingTiming(schoolId: string, formData: FormData) {
  const timing = String(formData.get("billing_timing_default"));
  const billingDay = integer(formData, "billing_day");
  const reviewDays = integer(formData, "payer_review_days");
  const chargeDay = integer(formData, "intended_charge_day");
  if (!["before_service", "after_service"].includes(timing)
    || !billingDay || billingDay < 1 || billingDay > 28
    || !reviewDays || reviewDays < 1 || reviewDays > 14
    || !chargeDay || chargeDay < 1 || chargeDay > 28) {
    redirect(`/schools/${schoolId}/products?billing=invalid`);
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(`/login?next=/schools/${schoolId}/products`);
  const { data: updated, error } = await supabase.from("schools").update({
    billing_timing_default: timing,
    billing_day: billingDay,
    payer_review_days: reviewDays,
    intended_charge_day: chargeDay,
  }).eq("id", schoolId).select("id").maybeSingle();
  if (error || !updated) redirect(`/schools/${schoolId}/products?billing=error`);
  revalidatePath(`/schools/${schoolId}/products`);
  redirect(`/schools/${schoolId}/products?billing=saved`);
}

export async function archiveProduct(schoolId: string, productId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(`/login?next=/schools/${schoolId}/products`);

  const [{ data: membership }, { data: product }] = await Promise.all([
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", data.claims.sub).eq("status", "active").maybeSingle(),
    supabase.from("service_products").select("id,name,status,stripe_account_id,stripe_product_id,stripe_price_id,stripe_sync_status")
      .eq("id", productId).eq("school_id", schoolId).maybeSingle(),
  ]);
  if (!membership || !["owner", "admin"].includes(membership.role) || !product || product.status !== "active") {
    redirect(`/schools/${schoolId}/products?error=archive`);
  }

  const admin = createAdminClient();
  if (product.stripe_sync_status === "synced" && product.stripe_account_id && product.stripe_product_id && product.stripe_price_id) {
    const { data: operation, error: prepareError } = await admin.from("stripe_catalog_operations").insert({
      school_id: schoolId, actor_profile_id: data.claims.sub, operation: "archive_offering", status: "prepared",
      request_snapshot: { service_product_id: product.id, name: product.name },
      provider_account_id: product.stripe_account_id, provider_product_id: product.stripe_product_id,
      provider_price_id: product.stripe_price_id, service_product_id: product.id,
    }).select("id").single();
    if (prepareError || !operation) redirect(`/schools/${schoolId}/products?error=archive`);
    try {
      await admin.from("stripe_catalog_operations").update({ status: "submitting" }).eq("id", operation.id);
      await getStripe().prices.update(product.stripe_price_id, { active: false }, { stripeAccount: product.stripe_account_id });
      await getStripe().products.update(product.stripe_product_id, { active: false }, { stripeAccount: product.stripe_account_id });
      const { data: archived, error } = await admin.from("service_products").update({ status: "archived" })
        .eq("id", product.id).eq("school_id", schoolId).select("id").maybeSingle();
      if (error || !archived) throw error ?? new Error("Local archive did not finish.");
      const { error: finalizeError } = await admin.from("stripe_catalog_operations").update({
        status: "succeeded", completed_at: new Date().toISOString(),
      }).eq("id", operation.id);
      if (finalizeError) throw finalizeError;
    } catch (error) {
      await admin.from("stripe_catalog_operations").update({
        status: "reconciliation_required", error_class: "provider_state_ambiguous",
        error_message: error instanceof Error ? error.message.slice(0, 500) : "Unknown archive error",
        completed_at: new Date().toISOString(),
      }).eq("id", operation.id);
      redirect(`/schools/${schoolId}/products?error=reconcile&reference=${operation.id.slice(0, 8).toUpperCase()}`);
    }
  } else {
    const { data: archived, error } = await admin.from("service_products").update({ status: "archived" })
      .eq("id", product.id).eq("school_id", schoolId).select("id").maybeSingle();
    if (error || !archived) redirect(`/schools/${schoolId}/products?error=archive`);
  }

  revalidatePath(`/schools/${schoolId}/products`);
  redirect(`/schools/${schoolId}/products?archived=1`);
}
