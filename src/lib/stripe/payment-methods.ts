import "server-only";

import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, getStripeMode } from "@/lib/stripe/server";

export const PAYMENT_METHOD_TERMS_VERSION = "off-session-approved-amounts-v1";

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function applicationUrl() {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3001";
  throw new Error("Missing required server environment variable: APP_URL");
}

function personName(person: { first_name: string; last_name: string; preferred_name: string | null }) {
  return `${person.preferred_name || person.first_name} ${person.last_name}`;
}

export async function createFamilyCardSetup(schoolId: string, billingAccountId: string, actorProfileId: string) {
  const admin = createAdminClient();
  const livemode = getStripeMode() === "live";
  const [schoolResult, accountResult, connectionResult] = await Promise.all([
    admin.from("schools").select("id, name, currency").eq("id", schoolId).single(),
    admin.from("billing_accounts").select("id, name, status, billing_contact_person_id").eq("school_id", schoolId).eq("id", billingAccountId).single(),
    admin.from("school_payment_connections").select("id, provider_account_id, status, charges_enabled")
      .eq("school_id", schoolId).eq("provider", "stripe").eq("livemode", livemode).single(),
  ]);
  if (schoolResult.error || accountResult.error || connectionResult.error) {
    throw schoolResult.error ?? accountResult.error ?? connectionResult.error;
  }
  const school = schoolResult.data;
  const account = accountResult.data;
  const connection = connectionResult.data;
  if (account.status !== "active") throw new Error("This billing account is not active.");
  if (connection.status !== "enabled" || !connection.charges_enabled || !connection.provider_account_id) {
    throw new Error("The school's Stripe account is not ready to save payment methods.");
  }

  const { data: contact, error: contactError } = await admin.from("people")
    .select("first_name, last_name, preferred_name, email, phone")
    .eq("school_id", schoolId).eq("id", account.billing_contact_person_id).single();
  if (contactError) throw contactError;

  const stripe = getStripe();
  const stripeAccount = connection.provider_account_id;
  const { data: existingCustomer, error: existingCustomerError } = await admin.from("billing_provider_customers")
    .select("id, provider_customer_id")
    .eq("payment_connection_id", connection.id).eq("billing_account_id", billingAccountId).maybeSingle();
  if (existingCustomerError) throw existingCustomerError;

  let providerCustomerId = existingCustomer?.provider_customer_id;
  if (!providerCustomerId) {
    const customer = await stripe.customers.create({
      name: personName(contact),
      email: contact.email ?? undefined,
      phone: contact.phone ?? undefined,
      metadata: { school_id: schoolId, billing_account_id: billingAccountId },
    }, {
      stripeAccount,
      idempotencyKey: `billing-customer-${connection.id}-${billingAccountId}-v1`,
    });
    providerCustomerId = customer.id;
  }

  const { data: providerCustomer, error: customerPersistError } = await admin.from("billing_provider_customers").upsert({
    school_id: schoolId,
    billing_account_id: billingAccountId,
    payment_connection_id: connection.id,
    provider_customer_id: providerCustomerId,
    email: contact.email,
    status: "active",
    last_synced_at: new Date().toISOString(),
  }, { onConflict: "payment_connection_id,billing_account_id" }).select("id").single();
  if (customerPersistError) throw customerPersistError;

  const termsText = `I authorize ${school.name} to save this payment method with Stripe and charge it off-session only for lesson or class amounts I have separately approved. I can revoke this authorization for future charges.`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const { data: setupRequest, error: requestError } = await admin.from("payment_method_setup_requests").insert({
    school_id: schoolId,
    billing_account_id: billingAccountId,
    provider_customer_id: providerCustomer.id,
    initiated_by: actorProfileId,
    terms_version: PAYMENT_METHOD_TERMS_VERSION,
    terms_text: termsText,
    terms_sha256: sha256(termsText),
    expires_at: expiresAt.toISOString(),
  }).select("id").single();
  if (requestError) throw requestError;

  const { error: auditError } = await admin.from("audit_log").insert({
    school_id: schoolId,
    actor_profile_id: actorProfileId,
    action: "payment_method.setup_started",
    entity_type: "payment_method_setup_request",
    entity_id: setupRequest.id,
    metadata: { billing_account_id: billingAccountId, livemode },
  });
  if (auditError) {
    await admin.from("payment_method_setup_requests").update({ status: "failed" }).eq("id", setupRequest.id);
    throw auditError;
  }

  try {
    const familyPath = `/schools/${schoolId}/families/${billingAccountId}`;
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      currency: school.currency.toLowerCase(),
      customer: providerCustomerId,
      payment_method_types: ["card"],
      client_reference_id: setupRequest.id,
      metadata: { school_id: schoolId, billing_account_id: billingAccountId, setup_request_id: setupRequest.id },
      setup_intent_data: { metadata: { school_id: schoolId, billing_account_id: billingAccountId, setup_request_id: setupRequest.id } },
      custom_text: { submit: { message: termsText } },
      success_url: `${applicationUrl()}${familyPath}?card=complete`,
      cancel_url: `${applicationUrl()}${familyPath}?card=canceled`,
      expires_at: Math.floor(expiresAt.getTime() / 1000),
    }, {
      stripeAccount,
      idempotencyKey: `payment-method-setup-${setupRequest.id}-v1`,
    });
    if (!session.url) throw new Error("Stripe did not return a hosted setup URL.");

    const { error: sessionPersistError } = await admin.from("payment_method_setup_requests")
      .update({ provider_checkout_session_id: session.id }).eq("id", setupRequest.id);
    if (sessionPersistError) {
      await stripe.checkout.sessions.expire(session.id, {}, { stripeAccount });
      throw sessionPersistError;
    }
    return session.url;
  } catch (error) {
    await admin.from("payment_method_setup_requests").update({ status: "failed" }).eq("id", setupRequest.id);
    throw error;
  }
}
