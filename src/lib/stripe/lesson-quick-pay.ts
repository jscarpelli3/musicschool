import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { completeHostedLessonCheckout, openHostedLessonCheckout } from "@/lib/stripe/lesson-quick-pay-workflow";
import { validateCompletedLessonCheckout } from "@/lib/stripe/lesson-quick-pay-validation";
import { getStripe, getStripeMode } from "@/lib/stripe/server";

function applicationUrl() {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3001";
  throw new Error("Missing required server environment variable: APP_URL");
}

export async function createLessonQuickPayment(schoolId: string, lessonId: string, actorProfileId: string) {
  const admin = createAdminClient();
  const livemode = getStripeMode() === "live";
  const [lessonResult, snapshotResult, connectionResult] = await Promise.all([
    admin.from("lesson_events").select("id,student_id,status").eq("school_id", schoolId).eq("id", lessonId).single(),
    admin.from("lesson_event_price_snapshots").select("id,source_product_id,billing_mode,amount_cents,currency,offering_name")
      .eq("school_id", schoolId).eq("lesson_event_id", lessonId).single(),
    admin.from("school_payment_connections").select("id,provider_account_id,status,charges_enabled")
      .eq("school_id", schoolId).eq("provider", "stripe").eq("livemode", livemode).single(),
  ]);
  if (lessonResult.error || snapshotResult.error || connectionResult.error) {
    throw lessonResult.error ?? snapshotResult.error ?? connectionResult.error;
  }
  const lesson = lessonResult.data;
  const snapshot = snapshotResult.data;
  const connection = connectionResult.data;
  if (!["scheduled", "completed"].includes(lesson.status)) throw new Error("Only a scheduled or completed lesson can be collected.");
  if (snapshot.billing_mode !== "per_session" || snapshot.amount_cents <= 0) throw new Error("Quick payment is available only for a positively priced per-lesson offering.");
  if (connection.status !== "enabled" || !connection.charges_enabled || !connection.provider_account_id) throw new Error("Finish connecting Stripe before collecting a payment.");

  const studentLinks = await admin.from("billing_account_students").select("billing_account_id")
    .eq("school_id", schoolId).eq("student_id", lesson.student_id);
  if (studentLinks.error) throw studentLinks.error;
  const linkedIds = (studentLinks.data ?? []).map((row) => row.billing_account_id);
  const activeAccounts = linkedIds.length ? await admin.from("billing_accounts").select("id")
    .eq("school_id", schoolId).eq("status", "active").in("id", linkedIds) : { data: [], error: null };
  if (activeAccounts.error) throw activeAccounts.error;
  const billingAccountIds = (activeAccounts.data ?? []).map((row) => row.id);
  if (billingAccountIds.length !== 1) throw new Error(billingAccountIds.length ? "Choose one billing account for this student before collecting." : "Attach an active billing account to this student before collecting.");
  const billingAccountId = billingAccountIds[0];

  const { data: succeeded, error: succeededError } = await admin.from("lesson_payment_requests").select("id")
    .eq("school_id", schoolId).eq("lesson_event_id", lessonId).eq("status", "succeeded").maybeSingle();
  if (succeededError) throw succeededError;
  if (succeeded) throw new Error("This lesson has already been paid separately.");
  const { data: existing, error: existingError } = await admin.from("lesson_payment_requests").select("id,checkout_url,expires_at,status")
    .eq("school_id", schoolId).eq("lesson_event_id", lessonId).in("status", ["created", "open"]).maybeSingle();
  if (existingError) throw existingError;
  if (existing?.status === "open" && existing.checkout_url && new Date(existing.expires_at).getTime() > Date.now()) return existing;
  if (existing && new Date(existing.expires_at).getTime() <= Date.now()) {
    const { error: expireError } = await admin.from("lesson_payment_requests").update({ status: "expired", checkout_url: null }).eq("id", existing.id).in("status", ["created", "open"]);
    if (expireError) throw expireError;
  }

  const { data: product, error: productError } = await admin.from("service_products")
    .select("stripe_account_id,stripe_price_id,stripe_sync_status").eq("school_id", schoolId).eq("id", snapshot.source_product_id).single();
  if (productError) throw productError;
  if (product.stripe_sync_status !== "synced" || !product.stripe_price_id || product.stripe_account_id !== connection.provider_account_id) {
    throw new Error("This offering must be synchronized with this school's Stripe account before collection.");
  }
  const stripe = getStripe();
  const providerPrice = await stripe.prices.retrieve(product.stripe_price_id, {}, { stripeAccount: connection.provider_account_id });
  if (!providerPrice.active || providerPrice.type !== "one_time" || providerPrice.unit_amount !== snapshot.amount_cents || providerPrice.currency.toUpperCase() !== snapshot.currency) {
    throw new Error("The Stripe price no longer matches this lesson's recorded price. Reconcile the offering before collecting.");
  }

  const reusable = existing?.status === "created" && new Date(existing.expires_at).getTime() > Date.now() ? existing : null;
  let paymentRequest = reusable;
  let expiresAt = reusable ? new Date(reusable.expires_at) : new Date(Date.now() + 35 * 60 * 1000);
  if (!paymentRequest) {
    const inserted = await admin.from("lesson_payment_requests").insert({
      school_id: schoolId,
      lesson_event_id: lessonId,
      lesson_event_price_snapshot_id: snapshot.id,
      billing_account_id: billingAccountId,
      payment_connection_id: connection.id,
      initiated_by: actorProfileId,
      amount_cents: snapshot.amount_cents,
      currency: snapshot.currency,
      expires_at: expiresAt.toISOString(),
    }).select("id,expires_at,status,checkout_url").single();
    if (inserted.error?.code === "23505") {
      const concurrent = await admin.from("lesson_payment_requests").select("id,expires_at,status,checkout_url")
        .eq("school_id", schoolId).eq("lesson_event_id", lessonId).in("status", ["created", "open"]).maybeSingle();
      if (concurrent.error) throw concurrent.error;
      paymentRequest = concurrent.data;
      if (paymentRequest) expiresAt = new Date(paymentRequest.expires_at);
    } else {
      if (inserted.error) throw inserted.error;
      paymentRequest = inserted.data;
    }
  }
  if (!paymentRequest) throw new Error("The payment request could not be prepared.");
  if (paymentRequest.status === "open" && paymentRequest.checkout_url) return paymentRequest;

  return openHostedLessonCheckout({
    requestId: paymentRequest.id,
    schoolId,
    lessonId,
    stripeAccount: connection.provider_account_id,
    stripePriceId: product.stripe_price_id,
    expiresAt,
    applicationUrl: applicationUrl(),
  }, {
    createSession: (parameters, options) => stripe.checkout.sessions.create(parameters, options),
    persistSession: async ({ requestId, sessionId, checkoutUrl }) => {
      const { data: persisted, error: persistError } = await admin.from("lesson_payment_requests").update({
        status: "open", provider_checkout_session_id: sessionId, checkout_url: checkoutUrl,
      }).eq("id", requestId).eq("status", "created").select("id").maybeSingle();
      if (persistError || !persisted) throw persistError ?? new Error("The payment request state changed before Checkout could be recorded.");
      const { error: auditError } = await admin.from("audit_log").insert({ school_id: schoolId, actor_profile_id: actorProfileId, action: "lesson_payment.opened", entity_type: "lesson_payment_request", entity_id: requestId, metadata: { lesson_event_id: lessonId, amount_cents: snapshot.amount_cents, currency: snapshot.currency } });
      if (auditError) console.error("Lesson payment opened without audit row", { requestId, code: auditError.code });
    },
  });
}

export async function reconcileCompletedLessonPayment(checkoutSessionId: string, stripeAccount: string, providerEventId: string, providerCreatedAt: string) {
  const admin = createAdminClient();
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, { expand: ["payment_intent.latest_charge"] }, { stripeAccount });
  const requestId = session.metadata?.lesson_payment_request_id;
  if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) return false;
  const { data: request, error } = await admin.from("lesson_payment_requests")
    .select("id,school_id,amount_cents,currency,status,provider_checkout_session_id,payment_connection_id")
    .eq("id", requestId).maybeSingle();
  if (error) throw error;
  if (!request) return false;
  const { data: connection, error: connectionError } = await admin.from("school_payment_connections").select("provider_account_id")
    .eq("id", request.payment_connection_id).eq("school_id", request.school_id).single();
  if (connectionError || connection.provider_account_id !== stripeAccount) throw connectionError ?? new Error("Lesson payment connected account does not match.");
  await completeHostedLessonCheckout({
    request: { requestId: request.id, amountCents: request.amount_cents, currency: request.currency },
    checkoutSessionId,
    stripeAccount,
    providerEventId,
    providerCreatedAt,
  }, {
    retrieveSession: async () => session,
    validateSession: validateCompletedLessonCheckout,
    completeRequest: async (completion) => {
      const { error: completeError } = await admin.rpc("complete_lesson_payment_request", {
        p_request_id: completion.requestId,
        p_checkout_session_id: completion.checkoutSessionId,
        p_payment_intent_id: completion.paymentIntentId,
        p_charge_id: completion.chargeId,
        p_provider_event_id: completion.providerEventId,
        p_succeeded_at: completion.providerCreatedAt,
      });
      if (completeError) throw completeError;
    },
  });
  return true;
}

export async function expireLessonPayment(checkoutSessionId: string, stripeAccount: string) {
  const admin = createAdminClient();
  const session = await getStripe().checkout.sessions.retrieve(checkoutSessionId, {}, { stripeAccount });
  const requestId = session.metadata?.lesson_payment_request_id;
  if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) return false;
  const { data: request, error: requestError } = await admin.from("lesson_payment_requests").select("id,school_id,payment_connection_id")
    .eq("id", requestId).maybeSingle();
  if (requestError) throw requestError;
  if (!request) return false;
  const { data: connection, error: connectionError } = await admin.from("school_payment_connections").select("provider_account_id")
    .eq("id", request.payment_connection_id).eq("school_id", request.school_id).single();
  if (connectionError || connection.provider_account_id !== stripeAccount) throw connectionError ?? new Error("Lesson payment connected account does not match.");
  const { data, error } = await admin.from("lesson_payment_requests").update({ status: "expired", checkout_url: null })
    .eq("id", request.id).in("status", ["created", "open"]).select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
