"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createFamilyCardSetup } from "@/lib/stripe/payment-methods";
import { getStripe } from "@/lib/stripe/server";
import { normalizeE164 } from "@/lib/phone";
import { billingApprovalEmail } from "@/lib/resend/billing-approval-email";
import { ResendRequestError, sendResendEmail } from "@/lib/resend/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTwilioMessagingServiceSid, sendTwilioMessage, TwilioRequestError } from "@/lib/twilio/server";

export type CardSetupLinkState = { url: string | null; error: string | null };
export type BillingApprovalSmsState = { ok: boolean; message: string };
export type BillingContactPhoneState = { ok: boolean; message: string };
export type BillingApprovalEmailState = { ok: boolean; message: string };
export type BillingContactEmailState = { ok: boolean; message: string };
export type BillingAdjustmentState = { ok: boolean; message: string };

function appOrigin() {
  const value = process.env.APP_URL?.trim();
  if (!value) throw new Error("Missing required server environment variable: APP_URL");
  return new URL(value).origin;
}

function emailDisplayName(value: string) {
  return value.replace(/[\r\n<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100) || "Common Time school";
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
      : detail.includes("after_service_period_is_not_complete") ? "period_incomplete"
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

export async function unlockUnsubmittedBillingPeriod(schoolId: string, billingAccountId: string, billingPeriodId: string) {
  const path = `/schools/${schoolId}/families/${billingAccountId}`;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect(`/login?next=${path}`);
  const { error } = await supabase.rpc("unlock_unsubmitted_billing_period", {
    p_billing_period_id: billingPeriodId,
    p_school_id: schoolId,
  });
  if (error) {
    const message = error.message.includes("replacement_flow")
      ? "An approval link already exists. Use the replacement flow so the old link is cancelled safely."
      : "This amount could not be unlocked. Nothing changed.";
    return { ok: false, message };
  }
  revalidatePath(path);
  return { ok: true, message: "Amount unlocked. Review or adjust it, then lock the new total." };
}

export async function reviseSubmittedBillingPeriod(schoolId: string, billingAccountId: string, billingPeriodId: string) {
  const path = `/schools/${schoolId}/families/${billingAccountId}`;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect(`/login?next=${path}`);
  const { error } = await supabase.rpc("revise_submitted_billing_period", {
    p_billing_period_id: billingPeriodId,
    p_school_id: schoolId,
  });
  if (error) return { ok: false, message: "The pending request could not be cancelled. The statement remains unchanged." };
  revalidatePath(path);
  return { ok: true, message: "Pending link cancelled. The statement is back in review and can be corrected safely." };
}

export async function addBillingAdjustment(
  schoolId: string,
  billingAccountId: string,
  billingPeriodId: string,
  _previous: BillingAdjustmentState,
  formData: FormData,
): Promise<BillingAdjustmentState> {
  void _previous;
  const path = `/schools/${schoolId}/families/${billingAccountId}`;
  const amountText = String(formData.get("amount") ?? "").trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(amountText)) return { ok: false, message: "Enter a positive dollar amount with no more than two decimal places." };
  const amountCents = Math.round(Number(amountText) * 100);
  const kind = String(formData.get("kind") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!["charge", "credit"].includes(kind) || !category || !description) return { ok: false, message: "Choose charge or credit, select a category, and explain the adjustment." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect(`/login?next=${path}`);
  const { error } = await supabase.rpc("add_billing_adjustment", {
    p_amount_cents: amountCents,
    p_billing_period_id: billingPeriodId,
    p_category: category,
    p_description: description,
    p_kind: kind,
    p_school_id: schoolId,
  });
  if (error) {
    const message = error.message.includes("not_editable")
      ? "This amount has already been locked. Start a revision before changing it."
      : "The adjustment could not be saved. The billing total is unchanged.";
    return { ok: false, message };
  }
  revalidatePath(path);
  return { ok: true, message: `${kind === "credit" ? "Credit" : "Charge"} added to the billing ledger.` };
}

export async function removeBillingAdjustment(schoolId: string, billingAccountId: string, billingPeriodId: string, adjustmentId: string) {
  const path = `/schools/${schoolId}/families/${billingAccountId}`;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect(`/login?next=${path}`);
  const { error } = await supabase.rpc("remove_billing_adjustment", {
    p_adjustment_id: adjustmentId,
    p_billing_period_id: billingPeriodId,
    p_school_id: schoolId,
  });
  if (error) return { ok: false, message: "This adjustment could not be removed. The billing total is unchanged." };
  revalidatePath(path);
  return { ok: true, message: "Adjustment removed from the billing ledger." };
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

export async function sendBillingApprovalEmail(
  schoolId: string,
  billingAccountId: string,
  billingPeriodId: string,
  _previous: BillingApprovalEmailState,
): Promise<BillingApprovalEmailState> {
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
  const { data: contact } = await supabase.from("people").select("first_name, last_name, preferred_name, email")
    .eq("school_id", schoolId).eq("id", account.billing_contact_person_id).maybeSingle();
  const email = contact?.email?.trim().toLowerCase() ?? "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 320) {
    return { ok: false, message: "Add a valid email address to the primary payer first." };
  }

  const rawToken = randomBytes(32).toString("base64url");
  const approvalUrl = `${appOrigin()}/approve/${rawToken}`;
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: period.currency }).format(period.amount_due_cents / 100);
  const payerName = `${contact?.preferred_name || contact?.first_name || "there"}${contact?.last_name ? ` ${contact.last_name}` : ""}`;
  const message = billingApprovalEmail({ schoolName: school.name, payerName, periodLabel: period.label, amount, approvalUrl });
  const from = `${emailDisplayName(school.name)} via Common Time <notifications@notifications.commontime.studio>`;
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const { data: prepared, error: prepareError } = await supabase.rpc("create_billing_approval_email_delivery", {
    p_body_sha256: hash(`${message.text}\n${message.html}`),
    p_billing_period_id: billingPeriodId,
    p_expires_at: expiresAt,
    p_from_address: from,
    p_recipient_email: email,
    p_school_id: schoolId,
    p_subject: message.subject,
    p_token_hash: hash(rawToken),
  }).maybeSingle();
  if (prepareError || !prepared) {
    const suppressed = prepareError?.message.includes("recipient_suppressed");
    return { ok: false, message: suppressed
      ? "Email is paused for this payer after a permanent delivery problem or complaint. Confirm a different address before sending."
      : "The approval request could not be prepared. No email was sent." };
  }

  const admin = createAdminClient();
  try {
    const sent = await sendResendEmail({ from, to: email, subject: message.subject, html: message.html, text: message.text, idempotencyKey: prepared.idempotency_key });
    const { error: completionError } = await admin.rpc("complete_email_provider_submission", {
      p_delivery_id: prepared.email_delivery_id,
      p_provider_email_id: sent.id,
    });
    if (completionError) {
      console.error("Resend accepted an email but local reconciliation failed", { deliveryId: prepared.email_delivery_id, code: completionError.code });
      return { ok: false, message: "Resend accepted the email, but its local status needs reconciliation. Do not resend yet." };
    }
  } catch (error) {
    const providerError = error instanceof ResendRequestError ? error : null;
    await admin.rpc("fail_email_provider_submission", {
      p_delivery_id: prepared.email_delivery_id,
      p_provider_error_code: providerError?.code ?? (providerError?.status ? String(providerError.status) : undefined),
      p_provider_error_message: providerError?.message ?? "Provider request failed.",
    });
    return { ok: false, message: "Resend did not accept the email. The failed attempt was recorded and can be retried." };
  }

  revalidatePath(path);
  return { ok: true, message: `Approval request sent to ${email}.` };
}

export async function retryBillingApprovalEmail(
  schoolId: string,
  billingAccountId: string,
  billingPeriodId: string,
  _previous: BillingApprovalEmailState,
): Promise<BillingApprovalEmailState> {
  void _previous;
  const path = `/schools/${schoolId}/families/${billingAccountId}`;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=${path}`);

  const [{ data: membership }, { data: school }, { data: account }, { data: request }] = await Promise.all([
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("schools").select("name").eq("id", schoolId).maybeSingle(),
    supabase.from("billing_accounts").select("billing_contact_person_id").eq("school_id", schoolId).eq("id", billingAccountId).maybeSingle(),
    supabase.from("billing_approval_requests").select("id, period_label, amount_cents, currency, approval_status")
      .eq("school_id", schoolId).eq("billing_account_id", billingAccountId).eq("billing_period_id", billingPeriodId)
      .order("request_version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!membership || !["owner", "admin"].includes(membership.role) || !school || !account || !request) {
    return { ok: false, message: "You do not have permission to retry this approval email." };
  }
  if (request.approval_status !== "pending") return { ok: false, message: "This approval request is no longer pending." };

  const [{ data: contact }, { data: priorDelivery }] = await Promise.all([
    supabase.from("people").select("first_name, last_name, preferred_name").eq("school_id", schoolId).eq("id", account.billing_contact_person_id).maybeSingle(),
    supabase.from("email_deliveries").select("recipient_email").eq("school_id", schoolId).eq("approval_request_id", request.id)
      .order("attempt_number", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!priorDelivery) return { ok: false, message: "The failed email attempt could not be found." };

  const rawToken = randomBytes(32).toString("base64url");
  const approvalUrl = `${appOrigin()}/approve/${rawToken}`;
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: request.currency }).format(request.amount_cents / 100);
  const payerName = `${contact?.preferred_name || contact?.first_name || "there"}${contact?.last_name ? ` ${contact.last_name}` : ""}`;
  const message = billingApprovalEmail({ schoolName: school.name, payerName, periodLabel: request.period_label, amount, approvalUrl });
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const { data: prepared, error: prepareError } = await supabase.rpc("retry_billing_approval_email_delivery", {
    p_approval_request_id: request.id,
    p_body_sha256: hash(`${message.text}\n${message.html}`),
    p_expires_at: expiresAt,
    p_school_id: schoolId,
    p_token_hash: hash(rawToken),
  }).maybeSingle();
  if (prepareError || !prepared) return { ok: false, message: prepareError?.message.includes("recipient_suppressed")
    ? "Email is paused for this payer after a permanent delivery problem or complaint."
    : "This failed email is no longer eligible for retry." };

  const admin = createAdminClient();
  try {
    const sent = await sendResendEmail({
      from: prepared.from_address, to: prepared.recipient_email, subject: prepared.subject,
      html: message.html, text: message.text, idempotencyKey: prepared.idempotency_key,
    });
    const { error } = await admin.rpc("complete_email_provider_submission", { p_delivery_id: prepared.email_delivery_id, p_provider_email_id: sent.id });
    if (error) return { ok: false, message: "Resend accepted the retry, but local reconciliation failed. Do not retry again yet." };
  } catch (error) {
    const providerError = error instanceof ResendRequestError ? error : null;
    await admin.rpc("fail_email_provider_submission", {
      p_delivery_id: prepared.email_delivery_id,
      p_provider_error_code: providerError?.code ?? (providerError?.status ? String(providerError.status) : undefined),
      p_provider_error_message: providerError?.message ?? "Provider request failed.",
    });
    return { ok: false, message: "Resend did not accept the retry. The approval request remains pending and can be retried again." };
  }
  revalidatePath(path);
  return { ok: true, message: `The same approval request was emailed again to ${priorDelivery.recipient_email}.` };
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

export async function updateBillingContactEmail(
  schoolId: string,
  billingAccountId: string,
  _previous: BillingContactEmailState,
  formData: FormData,
): Promise<BillingContactEmailState> {
  void _previous;
  const path = `/schools/${schoolId}/families/${billingAccountId}`;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 320) return { ok: false, message: "Enter a valid payer email address." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=${path}`);
  const { data: cancelledCount, error } = await supabase.rpc("update_billing_contact_email", {
    p_billing_account_id: billingAccountId,
    p_email: email,
    p_school_id: schoolId,
  });
  if (error) return { ok: false, message: "The email address could not be saved. Nothing changed." };
  revalidatePath(path);
  return { ok: true, message: cancelledCount
    ? `Payer email saved as ${email}. ${cancelledCount} pending approval ${cancelledCount === 1 ? "link was" : "links were"} invalidated; send again to the new address.`
    : `Payer email saved as ${email}.` };
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
