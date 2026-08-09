"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createFamilyCardSetup } from "@/lib/stripe/payment-methods";
import { getStripe } from "@/lib/stripe/server";
import { normalizeE164 } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTwilioMessagingServiceSid, sendTwilioMessage, TwilioRequestError } from "@/lib/twilio/server";

export type CardSetupLinkState = { url: string | null; error: string | null };
export type BillingApprovalSmsState = { ok: boolean; message: string };
export type BillingContactPhoneState = { ok: boolean; message: string };

function appOrigin() {
  const value = process.env.APP_URL?.trim();
  if (!value) throw new Error("Missing required server environment variable: APP_URL");
  return new URL(value).origin;
}

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

export async function sendBillingApprovalSms(
  schoolId: string,
  billingAccountId: string,
  billingPeriodId: string,
  _previous: BillingApprovalSmsState,
): Promise<BillingApprovalSmsState> {
  void _previous;
  const path = `/schools/${schoolId}/families/${billingAccountId}`;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=${path}`);

  const [{ data: membership }, { data: school }, { data: account }, { data: period }] = await Promise.all([
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("schools").select("name").eq("id", schoolId).maybeSingle(),
    supabase.from("billing_accounts").select("billing_contact_person_id").eq("school_id", schoolId).eq("id", billingAccountId).maybeSingle(),
    supabase.from("billing_periods").select("label, amount_due_cents, currency, status").eq("school_id", schoolId).eq("billing_account_id", billingAccountId).eq("id", billingPeriodId).maybeSingle(),
  ]);
  if (!membership || !["owner", "admin"].includes(membership.role) || !school || !account || !period) {
    return { ok: false, message: "You do not have permission to send this approval request." };
  }
  if (!["locked", "approval_pending"].includes(period.status) || period.amount_due_cents <= 0) {
    return { ok: false, message: "Lock a positive billing amount before requesting approval." };
  }

  const { data: contact } = await supabase.from("people").select("phone")
    .eq("school_id", schoolId).eq("id", account.billing_contact_person_id).maybeSingle();
  const phone = normalizeE164(contact?.phone ?? "");
  if (!phone) return { ok: false, message: "Add a valid mobile number to the primary payer first." };

  const admin = createAdminClient();
  const { data: consentState, error: consentError } = await admin.rpc("get_sms_consent_state", {
    p_phone_e164: phone,
    p_school_name: school.name,
  });
  if (consentError || consentState !== "opted_in") {
    const message = consentState === "opted_out"
      ? "This payer opted out. They must text START before another message can be sent."
      : "This payer has not completed the SMS consent form for this school.";
    return { ok: false, message };
  }

  const rawToken = randomBytes(32).toString("base64url");
  const approvalUrl = `${appOrigin()}/approve/${rawToken}`;
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: period.currency }).format(period.amount_due_cents / 100);
  const body = `${school.name}: Review and approve ${period.label} lesson charges (${amount}): ${approvalUrl} Approval does not charge your card. Reply STOP to opt out, HELP for help.`;
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const messagingServiceSid = getTwilioMessagingServiceSid();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  const { data: prepared, error: prepareError } = await supabase.rpc("create_billing_approval_sms_delivery", {
    p_body_sha256: hash(body),
    p_billing_period_id: billingPeriodId,
    p_expires_at: expiresAt,
    p_messaging_service_sid: messagingServiceSid,
    p_recipient_phone_e164: phone,
    p_school_id: schoolId,
    p_token_hash: hash(rawToken),
  }).maybeSingle();
  if (prepareError || !prepared) {
    return { ok: false, message: "The approval request could not be prepared. No text was sent." };
  }

  try {
    const message = await sendTwilioMessage({ to: phone, body });
    const { error: completionError } = await admin.rpc("complete_sms_provider_submission", {
      p_delivery_id: prepared.sms_delivery_id,
      p_provider_error_code: message.errorCode ?? undefined,
      p_provider_error_message: message.errorMessage ?? undefined,
      p_provider_message_sid: message.sid,
      p_provider_status: message.status,
    });
    if (completionError) {
      console.error("Twilio accepted a message but local reconciliation failed", { deliveryId: prepared.sms_delivery_id, code: completionError.code });
      return { ok: false, message: "Twilio accepted the text, but its local status needs reconciliation. Do not resend yet." };
    }
  } catch (error) {
    const providerError = error instanceof TwilioRequestError ? error : null;
    await admin.rpc("fail_sms_provider_submission", {
      p_delivery_id: prepared.sms_delivery_id,
      p_provider_error_code: providerError?.code ?? undefined,
      p_provider_error_message: providerError?.message ?? "Provider request failed.",
    });
    return { ok: false, message: "Twilio did not accept the text. The failed attempt was recorded and can be retried." };
  }

  revalidatePath(path);
  return { ok: true, message: `Approval request sent to the payer’s phone ending in ${phone.slice(-4)}.` };
}

export async function updateBillingContactPhone(
  schoolId: string,
  billingAccountId: string,
  _previous: BillingContactPhoneState,
  formData: FormData,
): Promise<BillingContactPhoneState> {
  void _previous;
  const path = `/schools/${schoolId}/families/${billingAccountId}`;
  const phone = normalizeE164(String(formData.get("phone") ?? ""));
  if (!phone) return { ok: false, message: "Enter a valid mobile number, including country code when outside the US." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=${path}`);
  const [{ data: membership }, { data: account }] = await Promise.all([
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("billing_accounts").select("billing_contact_person_id").eq("school_id", schoolId).eq("id", billingAccountId).maybeSingle(),
  ]);
  if (!membership || !["owner", "admin"].includes(membership.role) || !account) {
    return { ok: false, message: "You do not have permission to update this payer." };
  }

  const { error } = await supabase.from("people").update({ phone })
    .eq("school_id", schoolId).eq("id", account.billing_contact_person_id);
  if (error) return { ok: false, message: "The phone number could not be saved. Nothing changed." };
  revalidatePath(path);
  return { ok: true, message: `Mobile number saved ending in ${phone.slice(-4)}.` };
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
