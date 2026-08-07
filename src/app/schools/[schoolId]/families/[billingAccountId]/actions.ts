"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createFamilyCardSetup } from "@/lib/stripe/payment-methods";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CardSetupLinkState = { url: string | null; error: string | null };

export async function prepareFamilyBillingDraft(schoolId: string, billingAccountId: string, formData: FormData) {
  const path = `/schools/${schoolId}/families/${billingAccountId}`;
  const month = String(formData.get("month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) redirect(`${path}?billing=invalid_month`);

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect(`/login?next=${path}`);

  const { data: periodId, error } = await supabase.rpc("prepare_family_billing_draft", {
    p_school_id: schoolId,
    p_billing_account_id: billingAccountId,
    p_month: `${month}-01`,
  });

  if (error || !periodId) {
    const detail = error?.message ?? "";
    const status = detail.includes("lesson_requires_owner_review")
      || detail.includes("requires_owner_review")
      || detail.includes("missing_effective_cancellation_policy")
      ? "needs_review"
      : detail.includes("billing_period_is_not_refreshable") ? "not_refreshable" : "error";
    redirect(`${path}?billing=${status}`);
  }

  revalidatePath(path);
  redirect(`${path}?billing=prepared&period=${periodId}`);
}

export async function lockFamilyBillingPeriod(schoolId: string, billingAccountId: string, billingPeriodId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { ok: false, message: "Sign in again before locking this draft." };

  const { data, error } = await supabase.rpc("lock_family_billing_period", {
    p_school_id: schoolId,
    p_billing_period_id: billingPeriodId,
  });
  if (error || !data) {
    const message = error?.message.includes("positive line items")
      ? "Add at least one positive charge before locking."
      : "This draft could not be locked. Its prior state is unchanged.";
    return { ok: false, message };
  }

  revalidatePath(`/schools/${schoolId}/families/${billingAccountId}`);
  return { ok: true, message: "Amount locked. Lesson lines can no longer change." };
}

export async function generateFamilyCardSetupLink(
  schoolId: string,
  billingAccountId: string,
  previous: CardSetupLinkState,
): Promise<CardSetupLinkState> {
  void previous;
  const path = `/schools/${schoolId}/families/${billingAccountId}`;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=${path}`);

  const { data: membership, error } = await supabase.from("school_members").select("role")
    .eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle();
  if (error || !membership || !["owner", "admin"].includes(membership.role)) {
    return { url: null, error: "You do not have permission to create a setup link." };
  }

  try {
    const url = await createFamilyCardSetup(schoolId, billingAccountId, profileId);
    return { url, error: null };
  } catch (setupError) {
    console.error("Family card setup could not start", setupError);
    return { url: null, error: "Secure card setup could not start. No card information was collected." };
  }
}

export async function removeFamilyPaymentMethod(schoolId: string, billingAccountId: string, paymentMethodId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) return { ok: false, message: "Sign in again before removing this card." };

  const [{ data: membership }, { data: method }] = await Promise.all([
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("billing_payment_methods").select("id, status").eq("id", paymentMethodId).eq("school_id", schoolId).eq("billing_account_id", billingAccountId).maybeSingle(),
  ]);
  if (!membership || !["owner", "admin"].includes(membership.role) || !method || method.status === "detached") {
    return { ok: false, message: "This payment method cannot be removed." };
  }

  const admin = createAdminClient();
  const { error: auditStartError } = await admin.from("audit_log").insert({
    school_id: schoolId,
    actor_profile_id: profileId,
    action: "payment_method.revocation_started",
    entity_type: "billing_payment_method",
    entity_id: paymentMethodId,
    metadata: { billing_account_id: billingAccountId },
  });
  if (auditStartError) return { ok: false, message: "Removal could not be recorded. Nothing changed." };

  const { data: revocation, error: beginError } = await admin.rpc("begin_payment_method_revocation", {
    p_payment_method_id: paymentMethodId,
  }).maybeSingle();
  if (beginError || !revocation?.provider_account_id) {
    return { ok: false, message: "Removal could not start. The card will not be charged." };
  }

  try {
    await getStripe().paymentMethods.detach(revocation.provider_payment_method_id, {}, { stripeAccount: revocation.provider_account_id });
  } catch (error) {
    const missing = error instanceof Error && error.message.includes("No such PaymentMethod");
    if (!missing) return { ok: false, message: "Consent was revoked. Stripe removal is pending and can be retried." };
  }

  const { error: finishError } = await admin.rpc("complete_payment_method_revocation", { p_payment_method_id: paymentMethodId });
  if (finishError) return { ok: false, message: "Consent was revoked. Stripe removal completed; local reconciliation is pending." };

  const { error: auditCompleteError } = await admin.from("audit_log").insert({
    school_id: schoolId,
    actor_profile_id: profileId,
    action: "payment_method.revocation_completed",
    entity_type: "billing_payment_method",
    entity_id: paymentMethodId,
    metadata: { billing_account_id: billingAccountId },
  });
  if (auditCompleteError) return { ok: false, message: "The card was removed, but its audit entry needs reconciliation." };
  return { ok: true, message: "Future charge consent revoked and card removed from Stripe." };
}
