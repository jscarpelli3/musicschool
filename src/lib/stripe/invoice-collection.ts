import "server-only";

import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, getStripeMode } from "@/lib/stripe/server";
import { assertInvoicePaymentIntentBinding } from "@/lib/stripe/invoice-collection-validation";

type PreparedInvoiceCharge = {
  attemptId: string;
  idempotencyKey: string;
  amountCents: number;
  currency: string;
  stripeAccount: string;
  stripeCustomer: string;
  stripePaymentMethod: string;
};

function paymentIntentState(status: Stripe.PaymentIntent.Status) {
  if (status === "succeeded") return "succeeded";
  if (status === "processing") return "processing";
  if (status === "requires_action") return "requires_action";
  if (status === "requires_payment_method" || status === "canceled") return "failed";
  return "submitted";
}

async function prepareExactApprovedCharge(input: {
  schoolId: string;
  billingAccountId: string;
  billingPeriodId: string;
  approvalRequestId: string;
  actorProfileId: string;
  amountCents: number;
  currency: string;
}): Promise<PreparedInvoiceCharge> {
  const admin = createAdminClient();
  const livemode = getStripeMode() === "live";
  const [periodResult, approvalResult, connectionResult] = await Promise.all([
    admin.from("billing_periods").select("id,status,amount_due_cents,currency")
      .eq("school_id", input.schoolId).eq("billing_account_id", input.billingAccountId).eq("id", input.billingPeriodId).single(),
    admin.from("billing_approval_requests").select("id,approval_status,amount_cents,currency,billing_period_id")
      .eq("school_id", input.schoolId).eq("billing_account_id", input.billingAccountId).eq("id", input.approvalRequestId).single(),
    admin.from("school_payment_connections").select("id,provider_account_id,status,charges_enabled")
      .eq("school_id", input.schoolId).eq("provider", "stripe").eq("livemode", livemode).single(),
  ]);
  if (periodResult.error || approvalResult.error || connectionResult.error) throw new Error("The approved payment details could not be loaded.");
  const period = periodResult.data;
  const approval = approvalResult.data;
  const connection = connectionResult.data;
  if (period.status !== "approved" || period.amount_due_cents !== input.amountCents || period.currency !== input.currency) throw new Error("This statement is no longer ready to collect.");
  if (approval.approval_status !== "approved" || approval.billing_period_id !== period.id || approval.amount_cents !== period.amount_due_cents || approval.currency.toUpperCase() !== period.currency) throw new Error("The payer approval no longer matches this statement.");
  if (connection.status !== "enabled" || !connection.charges_enabled || !connection.provider_account_id) throw new Error("Finish connecting Stripe before collecting this payment.");

  const customerResult = await admin.from("billing_provider_customers").select("id,provider_customer_id,status")
    .eq("school_id", input.schoolId).eq("billing_account_id", input.billingAccountId).eq("payment_connection_id", connection.id).single();
  if (customerResult.error || customerResult.data.status !== "active") throw new Error("The family's Stripe customer is not active.");
  const customer = customerResult.data;
  const methodResult = await admin.from("billing_payment_methods").select("id,provider_payment_method_id")
    .eq("school_id", input.schoolId).eq("billing_account_id", input.billingAccountId).eq("provider_customer_id", customer.id)
    .eq("status", "active").eq("is_default", true).maybeSingle();
  if (methodResult.error || !methodResult.data) throw new Error("Choose a default active payment method before collecting.");
  const method = methodResult.data;
  const consentResult = await admin.from("payment_method_consents").select("id")
    .eq("school_id", input.schoolId).eq("billing_account_id", input.billingAccountId).eq("payment_method_id", method.id)
    .eq("usage_scope", "off_session").is("revoked_at", null).limit(1).maybeSingle();
  if (consentResult.error || !consentResult.data) throw new Error("The saved payment method is not authorized for off-session collection.");

  const idempotencyKey = crypto.randomUUID();
  const inserted = await admin.from("payment_attempts").insert({
    school_id: input.schoolId,
    billing_account_id: input.billingAccountId,
    billing_period_id: input.billingPeriodId,
    payment_connection_id: connection.id,
    provider_customer_id: customer.id,
    payment_method_id: method.id,
    approval_request_id: approval.id,
    amount_cents: period.amount_due_cents,
    currency: period.currency,
    idempotency_key: idempotencyKey,
    created_by: input.actorProfileId,
  }).select("id").single();
  if (inserted.error?.code === "23505") throw new Error("A payment for this statement is already in progress or has succeeded.");
  if (inserted.error) throw inserted.error;
  const { error: auditError } = await admin.from("audit_log").insert({
    school_id: input.schoolId,
    actor_profile_id: input.actorProfileId,
    action: "invoice_payment.prepared",
    entity_type: "payment_attempt",
    entity_id: inserted.data.id,
    metadata: { billing_account_id: input.billingAccountId, billing_period_id: input.billingPeriodId, amount_cents: period.amount_due_cents, currency: period.currency },
  });
  if (auditError) {
    await admin.from("payment_attempts").update({ status: "cancelled", failure_code: "audit_write_failed", failure_message: "Required audit row could not be written." }).eq("id", inserted.data.id).eq("status", "created");
    throw new Error("The charge was not submitted because its audit record could not be saved.");
  }
  return { attemptId: inserted.data.id, idempotencyKey, amountCents: period.amount_due_cents, currency: period.currency, stripeAccount: connection.provider_account_id, stripeCustomer: customer.provider_customer_id, stripePaymentMethod: method.provider_payment_method_id };
}

async function applyPaymentIntent(attemptId: string, stripeAccount: string, intent: Stripe.PaymentIntent, providerEventId: string | null) {
  const admin = createAdminClient();
  const charge = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id ?? null;
  const { error } = await admin.rpc("apply_invoice_payment_intent_event", {
    p_payment_attempt_id: attemptId,
    p_provider_account_id: stripeAccount,
    p_payment_intent_id: intent.id,
    p_status: providerEventId ? paymentIntentState(intent.status) : "submitted",
    p_charge_id: charge,
    p_failure_code: intent.last_payment_error?.code ?? null,
    p_failure_message: intent.last_payment_error?.message ?? null,
    p_provider_event_id: providerEventId,
  });
  if (error) throw error;
}

export async function collectApprovedInvoice(input: Parameters<typeof prepareExactApprovedCharge>[0]) {
  const prepared = await prepareExactApprovedCharge(input);
  const stripe = getStripe();
  try {
    const intent = await stripe.paymentIntents.create({
      amount: prepared.amountCents,
      currency: prepared.currency.toLowerCase(),
      customer: prepared.stripeCustomer,
      payment_method: prepared.stripePaymentMethod,
      confirm: true,
      off_session: true,
      metadata: {
        payment_attempt_id: prepared.attemptId,
        school_id: input.schoolId,
        billing_account_id: input.billingAccountId,
        billing_period_id: input.billingPeriodId,
      },
    }, { stripeAccount: prepared.stripeAccount, idempotencyKey: prepared.idempotencyKey });
    await applyPaymentIntent(prepared.attemptId, prepared.stripeAccount, intent, null);
    return { status: paymentIntentState(intent.status) };
  } catch (error) {
    const intent = error && typeof error === "object" && "payment_intent" in error
      ? (error as { payment_intent?: Stripe.PaymentIntent }).payment_intent : undefined;
    if (intent) {
      await applyPaymentIntent(prepared.attemptId, prepared.stripeAccount, intent, null);
      return { status: paymentIntentState(intent.status) };
    }
    throw new Error("Stripe may have received the charge, but its outcome could not be confirmed. Do not retry; wait for reconciliation.");
  }
}

export async function reconcileInvoicePaymentIntent(paymentIntentId: string, stripeAccount: string, providerEventId: string) {
  const stripe = getStripe();
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] }, { stripeAccount });
  const attemptId = intent.metadata.payment_attempt_id;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId ?? "")) return false;
  const admin = createAdminClient();
  const { data: attempt, error } = await admin.from("payment_attempts")
    .select("id,school_id,billing_account_id,billing_period_id,amount_cents,currency,payment_connection_id,provider_customer_id,payment_method_id")
    .eq("id", attemptId).maybeSingle();
  if (error) throw error;
  if (!attempt) return false;
  const [connection, customer, method] = await Promise.all([
    admin.from("school_payment_connections").select("provider_account_id").eq("id", attempt.payment_connection_id).single(),
    admin.from("billing_provider_customers").select("provider_customer_id").eq("id", attempt.provider_customer_id).single(),
    admin.from("billing_payment_methods").select("provider_payment_method_id").eq("id", attempt.payment_method_id!).single(),
  ]);
  if (connection.error || customer.error || method.error) throw connection.error ?? customer.error ?? method.error;
  const intentCustomer = typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
  const intentMethod = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
  assertInvoicePaymentIntentBinding({
    attemptId: attempt.id, schoolId: attempt.school_id, billingAccountId: attempt.billing_account_id,
    billingPeriodId: attempt.billing_period_id, amountCents: attempt.amount_cents, currency: attempt.currency,
    stripeAccount: connection.data.provider_account_id, stripeCustomer: customer.data.provider_customer_id,
    stripePaymentMethod: method.data.provider_payment_method_id,
  }, stripeAccount, { amount: intent.amount, currency: intent.currency, customer: intentCustomer ?? null, paymentMethod: intentMethod ?? null, metadata: intent.metadata });
  await applyPaymentIntent(attempt.id, stripeAccount, intent, providerEventId);
  return true;
}
