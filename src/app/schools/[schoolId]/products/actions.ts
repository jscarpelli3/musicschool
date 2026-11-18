"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkSchoolCapability } from "@/lib/auth/school-capabilities";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStripe, getStripeMode } from "@/lib/stripe/server";

export type ProductState = {
  error: string | null;
  product?: { id: string; label: string; durationMinutes: number; priceLabel: string };
};

function integer(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isInteger(value) ? value : null;
}

function cents(value: FormDataEntryValue | null) {
  const input = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(input)) return null;
  return Math.round(Number(input) * 100);
}

async function createProductRecord(schoolId: string, formData: FormData, redirectOnExpiredSession: boolean): Promise<ProductState> {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const format = String(formData.get("format"));
  const durationMinutes = integer(formData, "duration_minutes");
  const pricingModel = String(formData.get("pricing_model"));
  const billingTiming = String(formData.get("billing_timing"));
  const priceCents = cents(formData.get("price"));
  const requestedCapacity = integer(formData, "capacity");
  const capacity = format === "private_lesson" ? 1 : requestedCapacity;

  if (!name || name.length > 120) return { error: "Enter an offering name up to 120 characters." };
  if (!(["private_lesson", "group_class"] as string[]).includes(format)) return { error: "Choose a valid format." };
  if (!durationMinutes || durationMinutes < 15 || durationMinutes > 480) return { error: "Duration must be between 15 and 480 minutes." };
  if (!(["fixed_monthly", "per_session"] as string[]).includes(pricingModel)) return { error: "Choose a valid pricing model." };
  if (priceCents === null) return { error: "Enter a valid price with no more than two decimal places." };
  if (!capacity || capacity < 1 || capacity > 500) return { error: "Class capacity must be between 2 and 500." };
  if (!(["school_default", "before_service", "after_service"] as string[]).includes(billingTiming)) return { error: "Choose when this offering is billed." };

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const profileId = authData?.claims?.sub;
  if (!profileId) {
    if (redirectOnExpiredSession) redirect(`/login?next=/schools/${schoolId}/products`);
    return { error: "Your session expired. Sign in again before creating an offering." };
  }

  const livemode = getStripeMode() === "live";
  const [{ data: school }, { data: connection }, canManage] = await Promise.all([
    supabase.from("schools").select("currency").eq("id", schoolId).maybeSingle(),
    supabase.from("school_payment_connections").select("provider_account_id,status,charges_enabled")
      .eq("school_id", schoolId).eq("provider", "stripe").eq("livemode", livemode).maybeSingle(),
    checkSchoolCapability(supabase, schoolId, "school.products.manage"),
  ]);
  if (!school || !canManage) {
    return { error: "School not found or you do not have access." };
  }
  const admin = createAdminClient();
  const requestSnapshot = {
    name, description, format, duration_minutes: durationMinutes,
    pricing_model: pricingModel,
    billing_timing_override: billingTiming === "school_default" ? null : billingTiming,
    requested_price_cents: priceCents, currency: school.currency, capacity,
  };
  if (!connection?.provider_account_id || connection.status !== "enabled" || !connection.charges_enabled) {
    const { data: localProduct, error } = await admin.from("service_products").insert({
      school_id: schoolId, name, description, format, duration_minutes: durationMinutes,
      pricing_model: pricingModel, billing_timing_override: billingTiming === "school_default" ? null : billingTiming,
      currency: school.currency, capacity, price_cents: priceCents, created_by: profileId,
      stripe_sync_status: "local_only",
    }).select("id,name,duration_minutes,price_cents,currency").single();
    if (error || !localProduct) return { error: "The offering could not be saved. Nothing was sent to Stripe." };
    revalidatePath(`/schools/${schoolId}/products`);
    revalidatePath(`/schools/${schoolId}`);
    return { error: null, product: {
      id: localProduct.id,
      label: localProduct.name,
      durationMinutes: localProduct.duration_minutes,
      priceLabel: new Intl.NumberFormat("en-US", { style: "currency", currency: localProduct.currency }).format(localProduct.price_cents / 100),
    } };
  }
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
    }).select("id,name,duration_minutes,price_cents,currency").single();
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

  const { data: completedOperation } = await admin.from("stripe_catalog_operations").select("service_product_id").eq("id", operation.id).maybeSingle();
  const { data: createdProduct } = completedOperation?.service_product_id
    ? await admin.from("service_products").select("id,name,duration_minutes,price_cents,currency").eq("school_id", schoolId).eq("id", completedOperation.service_product_id).maybeSingle()
    : { data: null };
  if (!createdProduct) return { error: "The offering was created, but it could not be selected. Close and reopen the lesson form." };
  revalidatePath(`/schools/${schoolId}/products`);
  revalidatePath(`/schools/${schoolId}`);
  return { error: null, product: {
    id: createdProduct.id,
    label: createdProduct.name,
    durationMinutes: createdProduct.duration_minutes,
    priceLabel: new Intl.NumberFormat("en-US", { style: "currency", currency: createdProduct.currency }).format(createdProduct.price_cents / 100),
  } };
}

export async function createProduct(
  schoolId: string,
  returnPath: string | undefined,
  _state: ProductState,
  formData: FormData,
): Promise<ProductState> {
  const result = await createProductRecord(schoolId, formData, true);
  if (result.error) return result;
  const onboardingPath = `/schools/${schoolId}/onboarding?step=payments`;
  redirect(returnPath === onboardingPath ? `${onboardingPath}&created=1` : `/schools/${schoolId}/products?created=1`);
}

export async function createProductForLesson(
  schoolId: string,
  _state: ProductState,
  formData: FormData,
): Promise<ProductState> {
  return createProductRecord(schoolId, formData, false);
}

export async function setProductCatalogMode(schoolId: string, productId: string, mode: "local_only" | "synced") {
  const destination = `/schools/${schoolId}/products`;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=${destination}`);
  if (!await checkSchoolCapability(supabase, schoolId, "school.products.manage")) redirect(`/schools/${schoolId}`);

  const livemode = getStripeMode() === "live";
  const [{ data: product }, { data: connection }] = await Promise.all([
    supabase.from("service_products").select("id,name,description,price_cents,currency,status,stripe_account_id,stripe_product_id,stripe_price_id,stripe_sync_status").eq("school_id", schoolId).eq("id", productId).maybeSingle(),
    supabase.from("school_payment_connections").select("provider_account_id,status,charges_enabled").eq("school_id", schoolId).eq("provider", "stripe").eq("livemode", livemode).maybeSingle(),
  ]);
  if (!product || product.status !== "active") redirect(`${destination}?catalog=not-found`);
  if (product.stripe_sync_status === mode) redirect(`${destination}?catalog=unchanged`);
  const admin = createAdminClient();

  if (mode === "local_only") {
    if (product.stripe_sync_status !== "synced" || !product.stripe_account_id || !product.stripe_product_id || !product.stripe_price_id) {
      const { error } = await admin.from("service_products").update({ stripe_sync_status: "local_only" }).eq("school_id", schoolId).eq("id", product.id);
      if (error) redirect(`${destination}?catalog=error`);
    } else {
      const { data: operation, error: operationError } = await admin.from("stripe_catalog_operations").insert({
        school_id: schoolId, actor_profile_id: profileId, operation: "unsync_offering", status: "prepared",
        request_snapshot: { service_product_id: product.id, name: product.name }, provider_account_id: product.stripe_account_id,
        provider_product_id: product.stripe_product_id, provider_price_id: product.stripe_price_id, service_product_id: product.id,
      }).select("id").single();
      if (operationError || !operation) redirect(`${destination}?catalog=error`);
      try {
        await admin.from("stripe_catalog_operations").update({ status: "submitting" }).eq("id", operation.id);
        await getStripe().prices.update(product.stripe_price_id, { active: false }, { stripeAccount: product.stripe_account_id });
        await getStripe().products.update(product.stripe_product_id, { active: false }, { stripeAccount: product.stripe_account_id });
        const { error } = await admin.from("service_products").update({ stripe_sync_status: "local_only" }).eq("school_id", schoolId).eq("id", product.id);
        if (error) throw error;
        await admin.from("stripe_catalog_operations").update({ status: "succeeded", completed_at: new Date().toISOString() }).eq("id", operation.id);
      } catch (error) {
        await admin.from("stripe_catalog_operations").update({ status: "reconciliation_required", error_class: "provider_state_ambiguous", error_message: error instanceof Error ? error.message.slice(0, 500) : "Unknown catalog error", completed_at: new Date().toISOString() }).eq("id", operation.id);
        redirect(`${destination}?catalog=reconcile&reference=${operation.id.slice(0, 8).toUpperCase()}`);
      }
    }
    revalidatePath(destination);
    redirect(`${destination}?catalog=local`);
  }

  if (!connection?.provider_account_id || connection.status !== "enabled" || !connection.charges_enabled) redirect(`${destination}?catalog=connect-stripe`);
  const { data: operation, error: operationError } = await admin.from("stripe_catalog_operations").insert({
    school_id: schoolId, actor_profile_id: profileId, operation: "sync_offering", status: "prepared",
    request_snapshot: { service_product_id: product.id, name: product.name, price_cents: product.price_cents, currency: product.currency },
    provider_account_id: connection.provider_account_id, service_product_id: product.id,
  }).select("id").single();
  if (operationError || !operation) redirect(`${destination}?catalog=error`);
  try {
    await admin.from("stripe_catalog_operations").update({ status: "submitting" }).eq("id", operation.id);
    const providerProduct = await getStripe().products.create({ name: product.name, description: product.description ?? undefined, metadata: { commontime_school_id: schoolId, commontime_operation_id: operation.id } }, { stripeAccount: connection.provider_account_id, idempotencyKey: `catalog-resync-product-${operation.id}` });
    const providerPrice = await getStripe().prices.create({ product: providerProduct.id, currency: product.currency.toLowerCase(), unit_amount: product.price_cents, metadata: { commontime_school_id: schoolId, commontime_operation_id: operation.id } }, { stripeAccount: connection.provider_account_id, idempotencyKey: `catalog-resync-price-${operation.id}` });
    const { error } = await admin.from("service_products").update({ stripe_account_id: connection.provider_account_id, stripe_product_id: providerProduct.id, stripe_price_id: providerPrice.id, stripe_sync_status: "synced" }).eq("school_id", schoolId).eq("id", product.id);
    if (error) throw error;
    await admin.from("stripe_catalog_operations").update({ status: "succeeded", provider_product_id: providerProduct.id, provider_price_id: providerPrice.id, completed_at: new Date().toISOString() }).eq("id", operation.id);
  } catch (error) {
    await admin.from("stripe_catalog_operations").update({ status: "reconciliation_required", error_class: "provider_state_ambiguous", error_message: error instanceof Error ? error.message.slice(0, 500) : "Unknown catalog error", completed_at: new Date().toISOString() }).eq("id", operation.id);
    redirect(`${destination}?catalog=reconcile&reference=${operation.id.slice(0, 8).toUpperCase()}`);
  }
  revalidatePath(destination);
  redirect(`${destination}?catalog=synced`);
}

export async function updateSchoolBillingTiming(schoolId: string, formData: FormData) {
  const onboardingPath = `/schools/${schoolId}/onboarding?step=payments`;
  const returnPath = String(formData.get("return_path") ?? "");
  const destination = returnPath === onboardingPath ? onboardingPath : `/schools/${schoolId}/products`;
  const timing = String(formData.get("billing_timing_default"));
  const billingDay = integer(formData, "billing_day");
  const reviewDays = integer(formData, "payer_review_days");
  const chargeDay = integer(formData, "intended_charge_day");
  if (!["before_service", "after_service"].includes(timing)
    || !billingDay || billingDay < 1 || billingDay > 28
    || !reviewDays || reviewDays < 1 || reviewDays > 14
    || !chargeDay || chargeDay < 1 || chargeDay > 28) {
    redirect(`${destination}${destination.includes("?") ? "&" : "?"}billing=invalid`);
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(`/login?next=${encodeURIComponent(destination)}`);
  if (!await checkSchoolCapability(supabase, schoolId, "school.products.manage")) redirect(`/schools/${schoolId}`);
  const { data: updated, error } = await supabase.from("schools").update({
    billing_timing_default: timing,
    billing_day: billingDay,
    payer_review_days: reviewDays,
    intended_charge_day: chargeDay,
  }).eq("id", schoolId).select("id").maybeSingle();
  if (error || !updated) redirect(`${destination}${destination.includes("?") ? "&" : "?"}billing=error`);
  revalidatePath(`/schools/${schoolId}/products`);
  revalidatePath(`/schools/${schoolId}/onboarding`);
  redirect(`${destination}${destination.includes("?") ? "&" : "?"}billing=saved`);
}

export async function archiveProduct(schoolId: string, productId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(`/login?next=/schools/${schoolId}/products`);

  const [{ data: product }, canManage] = await Promise.all([
    supabase.from("service_products").select("id,name,status,stripe_account_id,stripe_product_id,stripe_price_id,stripe_sync_status")
      .eq("id", productId).eq("school_id", schoolId).maybeSingle(),
    checkSchoolCapability(supabase, schoolId, "school.products.manage"),
  ]);
  if (!canManage || !product || product.status !== "active") {
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
