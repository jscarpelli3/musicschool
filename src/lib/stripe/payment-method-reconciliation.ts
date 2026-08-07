import "server-only";

import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";

function stripeId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}

export async function reconcileCompletedCardSetup(checkoutSessionId: string, stripeAccount: string, acceptedAt: string) {
  const stripe = getStripe();
  const admin = createAdminClient();
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, { expand: ["setup_intent"] }, { stripeAccount });
  if (session.mode !== "setup" || session.status !== "complete") throw new Error("Checkout setup session is not complete.");

  const setupRequestId = session.client_reference_id ?? session.metadata?.setup_request_id;
  const customerId = stripeId(session.customer);
  const setupIntentId = stripeId(session.setup_intent);
  if (!setupRequestId || !customerId || !setupIntentId) throw new Error("Checkout setup session is missing its durable binding.");

  const setupIntent = typeof session.setup_intent === "string"
    ? await stripe.setupIntents.retrieve(session.setup_intent, {}, { stripeAccount })
    : session.setup_intent as Stripe.SetupIntent;
  const paymentMethodId = stripeId(setupIntent.payment_method);
  if (setupIntent.status !== "succeeded" || !paymentMethodId) throw new Error("Stripe has not completed the payment method setup.");

  const [{ data: request, error: requestError }, paymentMethod] = await Promise.all([
    admin.from("payment_method_setup_requests")
      .select("id, school_id, billing_account_id, provider_customer_id, provider_checkout_session_id")
      .eq("id", setupRequestId).single(),
    stripe.paymentMethods.retrieve(paymentMethodId, {}, { stripeAccount }),
  ]);
  if (requestError) throw requestError;
  if (request.provider_checkout_session_id !== checkoutSessionId) throw new Error("Checkout session binding does not match.");

  const { data: providerCustomer, error: customerError } = await admin.from("billing_provider_customers")
    .select("provider_customer_id").eq("id", request.provider_customer_id).single();
  if (customerError) throw customerError;
  if (providerCustomer.provider_customer_id !== customerId) throw new Error("Stripe Customer does not match the family setup request.");

  const card = paymentMethod.card;
  if (!card) throw new Error("Stripe setup did not return the required card details.");
  const displayLabel = `${card.brand.replaceAll("_", " ")} •••• ${card.last4}`;
  const { data: paymentMethodRecordId, error: completionError } = await admin.rpc("complete_payment_method_setup", {
    p_setup_request_id: request.id,
    p_provider_checkout_session_id: checkoutSessionId,
    p_provider_setup_intent_id: setupIntentId,
    p_provider_payment_method_id: paymentMethod.id,
    p_method_type: paymentMethod.type === "card" ? "card" : "other",
    p_display_label: displayLabel,
    p_brand: card.brand,
    p_last_four: card.last4,
    p_exp_month: card.exp_month,
    p_exp_year: card.exp_year,
    p_accepted_at: acceptedAt,
    p_evidence: {
      checkout_session_id: checkoutSessionId,
      setup_intent_id: setupIntentId,
      payment_method_type: paymentMethod.type,
      stripe_account: stripeAccount,
    },
  });
  if (completionError) throw completionError;

  const { error: auditError } = await admin.from("audit_log").insert({
    school_id: request.school_id,
    actor_profile_id: null,
    action: "payment_method.setup_completed",
    entity_type: "billing_payment_method",
    entity_id: paymentMethodRecordId,
    metadata: { billing_account_id: request.billing_account_id, checkout_session_id: checkoutSessionId },
  });
  if (auditError) throw auditError;
}

export async function expireCardSetup(checkoutSessionId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("payment_method_setup_requests").update({ status: "expired" })
    .eq("provider_checkout_session_id", checkoutSessionId).eq("status", "pending");
  if (error) throw error;
}
