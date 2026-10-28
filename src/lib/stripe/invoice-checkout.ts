import "server-only";

import crypto from "node:crypto";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileInvoicePaymentIntent } from "@/lib/stripe/invoice-collection";
import { getStripe, getStripeMode } from "@/lib/stripe/server";

function applicationUrl() {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3001";
  throw new Error("Missing required server environment variable: APP_URL");
}

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createApprovedInvoiceCheckout(rawToken: string | null, ownerScope?: { schoolId: string; billingAccountId: string; billingPeriodId: string }) {
  const admin = createAdminClient();
  const livemode = getStripeMode() === "live";
  let approvalQuery = admin.from("billing_approval_requests")
    .select("id,school_id,billing_account_id,billing_period_id,approval_status,amount_cents,currency,expires_at,created_by,period_label");
  approvalQuery = rawToken
    ? approvalQuery.eq("token_hash", tokenHash(rawToken))
    : approvalQuery.eq("school_id", ownerScope!.schoolId).eq("billing_account_id", ownerScope!.billingAccountId).eq("billing_period_id", ownerScope!.billingPeriodId).eq("approval_status", "approved").order("request_version", { ascending: false }).limit(1);
  const { data: approval, error: approvalError } = await approvalQuery.maybeSingle();
  if (approvalError || !approval) throw new Error("This invoice approval could not be found.");
  if (approval.approval_status !== "approved" || !approval.billing_period_id || new Date(approval.expires_at).getTime() <= Date.now()) throw new Error("This approved invoice is no longer available for one-time payment.");

  const [periodResult, connectionResult, accountResult] = await Promise.all([
    admin.from("billing_periods").select("id,status,amount_due_cents,currency,label").eq("school_id", approval.school_id).eq("billing_account_id", approval.billing_account_id).eq("id", approval.billing_period_id).single(),
    admin.from("school_payment_connections").select("id,provider_account_id,status,charges_enabled").eq("school_id", approval.school_id).eq("provider", "stripe").eq("livemode", livemode).single(),
    admin.from("billing_accounts").select("id,status,billing_contact_person_id").eq("school_id", approval.school_id).eq("id", approval.billing_account_id).single(),
  ]);
  if (periodResult.error || connectionResult.error || accountResult.error) throw new Error("The approved invoice payment details could not be loaded.");
  const period = periodResult.data;
  const connection = connectionResult.data;
  const account = accountResult.data;
  if (!['approved','payment_failed'].includes(period.status) || period.amount_due_cents !== approval.amount_cents || period.currency.toLowerCase() !== approval.currency.toLowerCase()) throw new Error("The approved amount no longer matches this invoice.");
  if (account.status !== "active") throw new Error("This family billing account is not active.");
  if (connection.status !== "enabled" || !connection.charges_enabled || !connection.provider_account_id) throw new Error("The school must finish connecting Stripe before accepting payment.");

  const existingRequest = await admin.from("invoice_checkout_requests").select("id,status,checkout_url,expires_at")
    .eq("billing_period_id", period.id).in("status", ["created", "open"]).maybeSingle();
  if (existingRequest.error) throw existingRequest.error;
  if (existingRequest.data?.status === "open" && existingRequest.data.checkout_url && new Date(existingRequest.data.expires_at).getTime() > Date.now()) return existingRequest.data.checkout_url;

  const { data: contact, error: contactError } = await admin.from("people").select("first_name,last_name,preferred_name,email,phone")
    .eq("school_id", approval.school_id).eq("id", account.billing_contact_person_id).single();
  if (contactError) throw new Error("The payer contact could not be loaded.");
  const stripe = getStripe();
  const stripeAccount = connection.provider_account_id;
  const { data: existingCustomer, error: customerReadError } = await admin.from("billing_provider_customers").select("id,provider_customer_id,status")
    .eq("payment_connection_id", connection.id).eq("billing_account_id", approval.billing_account_id).maybeSingle();
  if (customerReadError) throw customerReadError;
  let providerCustomerId = existingCustomer?.provider_customer_id ?? null;
  if (providerCustomerId) {
    try {
      const retrieved = await stripe.customers.retrieve(providerCustomerId, {}, { stripeAccount });
      if (retrieved.deleted) providerCustomerId = null;
    } catch { providerCustomerId = null; }
  }
  if (!providerCustomerId) {
    const customer = await stripe.customers.create({
      name: `${contact.preferred_name || contact.first_name} ${contact.last_name}`,
      email: contact.email ?? undefined,
      phone: contact.phone ?? undefined,
      metadata: { school_id: approval.school_id, billing_account_id: approval.billing_account_id },
    }, { stripeAccount, idempotencyKey: `billing-customer-${connection.id}-${approval.billing_account_id}-v2` });
    providerCustomerId = customer.id;
  }
  const { data: localCustomer, error: customerWriteError } = await admin.from("billing_provider_customers").upsert({
    school_id: approval.school_id, billing_account_id: approval.billing_account_id, payment_connection_id: connection.id,
    provider_customer_id: providerCustomerId, email: contact.email, status: "active", last_synced_at: new Date().toISOString(),
  }, { onConflict: "payment_connection_id,billing_account_id" }).select("id").single();
  if (customerWriteError) throw new Error("The family payment profile could not be prepared.");

  const actorId = approval.created_by;
  if (!actorId) throw new Error("The original invoice sender could not be verified.");
  const idempotencyKey = crypto.randomUUID();
  const { data: attempt, error: attemptError } = await admin.from("payment_attempts").insert({
    school_id: approval.school_id, billing_account_id: approval.billing_account_id, billing_period_id: period.id,
    payment_connection_id: connection.id, provider_customer_id: localCustomer.id, payment_method_id: null,
    approval_request_id: approval.id, amount_cents: period.amount_due_cents, currency: period.currency,
    idempotency_key: idempotencyKey, created_by: actorId,
  }).select("id").single();
  if (attemptError?.code === "23505") throw new Error("A payment for this invoice is already in progress.");
  if (attemptError) throw attemptError;
  const expiresAt = new Date(Math.min(new Date(approval.expires_at).getTime(), Date.now() + 24 * 60 * 60 * 1000));
  const { data: request, error: requestError } = await admin.from("invoice_checkout_requests").insert({
    school_id: approval.school_id, billing_account_id: approval.billing_account_id, billing_period_id: period.id,
    approval_request_id: approval.id, payment_attempt_id: attempt.id, payment_connection_id: connection.id,
    provider_customer_id: localCustomer.id, amount_cents: period.amount_due_cents, currency: period.currency, expires_at: expiresAt.toISOString(),
  }).select("id").single();
  if (requestError) {
    await admin.from("payment_attempts").update({ status: "cancelled", failure_code: "checkout_request_failed" }).eq("id", attempt.id).eq("status", "created");
    throw requestError;
  }
  const { error: auditError } = await admin.from("audit_log").insert({
    school_id: approval.school_id, actor_profile_id: actorId, action: "invoice_checkout.prepared",
    entity_type: "invoice_checkout_request", entity_id: request.id,
    metadata: { billing_account_id: approval.billing_account_id, billing_period_id: period.id, approval_request_id: approval.id, amount_cents: period.amount_due_cents, currency: period.currency, initiated_surface: rawToken ? "approval_link" : "owner_invoice_workspace" },
  });
  if (auditError) {
    await admin.from("invoice_checkout_requests").update({ status: "failed" }).eq("id", request.id).eq("status", "created");
    await admin.from("payment_attempts").update({ status: "cancelled", failure_code: "audit_write_failed" }).eq("id", attempt.id).eq("status", "created");
    throw new Error("The payment page was not opened because its audit record could not be saved.");
  }
  try {
    const metadata = { invoice_checkout_request_id: request.id, payment_attempt_id: attempt.id, school_id: approval.school_id, billing_account_id: approval.billing_account_id, billing_period_id: period.id };
    const session = await stripe.checkout.sessions.create({
      mode: "payment", payment_method_types: ["card"], customer_creation: "if_required", customer_email: contact.email ?? undefined,
      line_items: [{ price_data: { currency: period.currency.toLowerCase(), unit_amount: period.amount_due_cents, product_data: { name: `${period.label} lesson invoice` } }, quantity: 1 }],
      client_reference_id: request.id, metadata, payment_intent_data: { metadata },
      success_url: `${applicationUrl()}/payment-complete`, cancel_url: `${applicationUrl()}/payment-canceled`,
      expires_at: Math.floor(expiresAt.getTime() / 1000),
    }, { stripeAccount, idempotencyKey: `invoice-one-time-${request.id}-v1` });
    if (!session.url) throw new Error("Stripe did not return a hosted payment page.");
    const persisted = await admin.from("invoice_checkout_requests").update({ status: "open", provider_checkout_session_id: session.id, checkout_url: session.url })
      .eq("id", request.id).eq("status", "created").select("id").maybeSingle();
    if (persisted.error || !persisted.data) {
      await stripe.checkout.sessions.expire(session.id, {}, { stripeAccount });
      throw new Error("The hosted payment page could not be recorded safely.");
    }
    return session.url;
  } catch (error) {
    await admin.from("invoice_checkout_requests").update({ status: "failed", checkout_url: null }).eq("id", request.id).in("status", ["created", "open"]);
    await admin.from("payment_attempts").update({ status: "cancelled", failure_code: "checkout_creation_failed" }).eq("id", attempt.id).eq("status", "created");
    throw error;
  }
}

type ExpandedCheckout = Stripe.Checkout.Session & { payment_intent: Stripe.PaymentIntent & { latest_charge: Stripe.Charge } };

export async function reconcileCompletedInvoiceCheckout(checkoutSessionId: string, stripeAccount: string, providerEventId: string | null) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, { expand: ["payment_intent.latest_charge"] }, { stripeAccount }) as ExpandedCheckout;
  const requestId = session.metadata?.invoice_checkout_request_id;
  if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) return false;
  const admin = createAdminClient();
  const { data: request, error } = await admin.from("invoice_checkout_requests").select("id,school_id,billing_account_id,billing_period_id,payment_attempt_id,payment_connection_id,provider_customer_id,provider_checkout_session_id,amount_cents,currency")
    .eq("id", requestId).maybeSingle();
  if (error) throw error;
  if (!request) return false;
  const connection = await admin.from("school_payment_connections").select("provider_account_id").eq("id", request.payment_connection_id).single();
  if (connection.error) throw connection.error;
  const intent = typeof session.payment_intent === "string" ? null : session.payment_intent;
  const charge = intent && typeof intent.latest_charge !== "string" ? intent.latest_charge : null;
  const sessionCustomer = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (connection.data.provider_account_id !== stripeAccount || request.provider_checkout_session_id !== session.id
    || session.mode !== "payment" || session.payment_status !== "paid" || session.client_reference_id !== request.id
    || session.amount_total !== request.amount_cents || session.currency?.toUpperCase() !== request.currency
    || sessionCustomer !== undefined || !intent || intent.status !== "succeeded" || intent.customer !== null
    || !charge || !charge.paid || charge.amount !== request.amount_cents || charge.currency.toUpperCase() !== request.currency
    || session.metadata?.payment_attempt_id !== request.payment_attempt_id || session.metadata.school_id !== request.school_id
    || session.metadata.billing_account_id !== request.billing_account_id || session.metadata.billing_period_id !== request.billing_period_id) {
    throw new Error("Invoice Checkout payment binding or status does not match.");
  }
  const { error: completeError } = await admin.rpc("complete_invoice_checkout_request", {
    p_request_id: request.id, p_provider_account_id: stripeAccount, p_checkout_session_id: session.id,
    // PostgreSQL accepts null here for an authoritative API reconciliation; generated types
    // model only the webhook path, where the provider event id is always present.
    p_payment_intent_id: intent.id, p_charge_id: charge.id, p_provider_event_id: providerEventId as string,
  });
  if (completeError) throw completeError;
  return true;
}

export async function reconcileOpenInvoiceCheckout(schoolId: string, billingAccountId: string, billingPeriodId: string) {
  const admin = createAdminClient();
  const { data: request, error } = await admin.from("invoice_checkout_requests")
    .select("id,payment_attempt_id,payment_connection_id,provider_checkout_session_id,status")
    .eq("school_id", schoolId)
    .eq("billing_account_id", billingAccountId)
    .eq("billing_period_id", billingPeriodId)
    .eq("status", "open")
    .maybeSingle();
  if (error) throw error;
  if (!request?.provider_checkout_session_id) return false;

  const { data: connection, error: connectionError } = await admin.from("school_payment_connections")
    .select("provider_account_id")
    .eq("id", request.payment_connection_id)
    .single();
  if (connectionError || !connection.provider_account_id) throw connectionError ?? new Error("The Stripe connection could not be loaded.");

  const stripeAccount = connection.provider_account_id;
  const session = await getStripe().checkout.sessions.retrieve(
    request.provider_checkout_session_id,
    { expand: ["payment_intent"] },
    { stripeAccount },
  );
  if (session.id !== request.provider_checkout_session_id
    || session.client_reference_id !== request.id
    || session.metadata?.invoice_checkout_request_id !== request.id
    || session.metadata?.payment_attempt_id !== request.payment_attempt_id
    || session.metadata?.school_id !== schoolId
    || session.metadata?.billing_account_id !== billingAccountId
    || session.metadata?.billing_period_id !== billingPeriodId) {
    throw new Error("Invoice Checkout status binding does not match.");
  }

  if (session.status === "expired") return expireInvoiceCheckout(session.id, stripeAccount);
  const intent = typeof session.payment_intent === "string" ? null : session.payment_intent;
  if (!intent) return false;
  if (session.payment_status === "paid" && intent.status === "succeeded") {
    return reconcileCompletedInvoiceCheckout(session.id, stripeAccount, null);
  }
  await reconcileInvoicePaymentIntent(intent.id, stripeAccount, null, true);
  return true;
}

export async function expireInvoiceCheckout(checkoutSessionId: string, stripeAccount: string) {
  const session = await getStripe().checkout.sessions.retrieve(checkoutSessionId, {}, { stripeAccount });
  const requestId = session.metadata?.invoice_checkout_request_id;
  if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) return false;
  const { error } = await createAdminClient().rpc("expire_invoice_checkout_request", { p_request_id: requestId, p_provider_account_id: stripeAccount, p_checkout_session_id: checkoutSessionId });
  if (error) throw error;
  return true;
}
