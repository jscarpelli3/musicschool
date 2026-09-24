import assert from "node:assert/strict";
import test from "node:test";

import { completeHostedLessonCheckout, openHostedLessonCheckout } from "../src/lib/stripe/lesson-quick-pay-workflow.ts";
import { validateCompletedLessonCheckout } from "../src/lib/stripe/lesson-quick-pay-validation.ts";

const checkoutInput = {
  requestId: "11111111-1111-1111-1111-111111111111",
  schoolId: "22222222-2222-2222-2222-222222222222",
  lessonId: "33333333-3333-3333-3333-333333333333",
  stripeAccount: "acct_test_school",
  stripePriceId: "price_test_lesson",
  expiresAt: new Date("2099-01-01T00:35:00.000Z"),
  applicationUrl: "https://staging.example.test",
};

function paidSession() {
  return {
    mode: "payment",
    payment_status: "paid",
    client_reference_id: checkoutInput.requestId,
    amount_total: 5500,
    currency: "usd",
    payment_intent: {
      id: "pi_paid",
      status: "succeeded",
      latest_charge: { id: "ch_paid", paid: true, amount: 5500, currency: "usd" },
    },
  };
}

test("binds Checkout to the school, lesson, request, connected account, and stable idempotency key", async () => {
  let observedParameters;
  let observedOptions;
  let observedPersistence;
  const result = await openHostedLessonCheckout(checkoutInput, {
    async createSession(parameters, options) {
      observedParameters = parameters;
      observedOptions = options;
      return { id: "cs_test_bound", url: "https://checkout.stripe.test/cs_test_bound" };
    },
    async persistSession(session) { observedPersistence = session; },
  });

  assert.equal(observedParameters.client_reference_id, checkoutInput.requestId);
  assert.deepEqual(observedParameters.metadata, {
    school_id: checkoutInput.schoolId,
    lesson_event_id: checkoutInput.lessonId,
    lesson_payment_request_id: checkoutInput.requestId,
  });
  assert.deepEqual(observedParameters.payment_intent_data.metadata, observedParameters.metadata);
  assert.deepEqual(observedOptions, {
    stripeAccount: checkoutInput.stripeAccount,
    idempotencyKey: `lesson-quick-payment-${checkoutInput.requestId}-v1`,
  });
  assert.deepEqual(observedPersistence, {
    requestId: checkoutInput.requestId,
    sessionId: "cs_test_bound",
    checkoutUrl: "https://checkout.stripe.test/cs_test_bound",
  });
  assert.equal(result.status, "open");
});

test("does not write local Checkout state when Stripe rejects the request", async () => {
  let persistenceCalls = 0;
  await assert.rejects(openHostedLessonCheckout(checkoutInput, {
    async createSession() { throw new Error("stripe unavailable"); },
    async persistSession() { persistenceCalls += 1; },
  }), /stripe unavailable/);
  assert.equal(persistenceCalls, 0);
});

test("recovers after Stripe succeeds but the first local write fails", async () => {
  const idempotencyKeys = [];
  let persistenceCalls = 0;
  const ports = {
    async createSession(_parameters, options) {
      idempotencyKeys.push(options.idempotencyKey);
      return { id: "cs_test_recovered", url: "https://checkout.stripe.test/cs_test_recovered" };
    },
    async persistSession() {
      persistenceCalls += 1;
      if (persistenceCalls === 1) throw new Error("database write failed");
    },
  };

  await assert.rejects(openHostedLessonCheckout(checkoutInput, ports), /database write failed/);
  const recovered = await openHostedLessonCheckout(checkoutInput, ports);

  assert.deepEqual(idempotencyKeys, [
    `lesson-quick-payment-${checkoutInput.requestId}-v1`,
    `lesson-quick-payment-${checkoutInput.requestId}-v1`,
  ]);
  assert.equal(recovered.checkout_url, "https://checkout.stripe.test/cs_test_recovered");
  assert.equal(persistenceCalls, 2);
});

test("retries an ambiguous Stripe timeout with the same idempotency key", async () => {
  const idempotencyKeys = [];
  let providerCalls = 0;
  let persistedSessionId = null;
  const ports = {
    async createSession(_parameters, options) {
      providerCalls += 1;
      idempotencyKeys.push(options.idempotencyKey);
      if (providerCalls === 1) throw new Error("connection ended before Stripe's response");
      return { id: "cs_test_accepted_before_timeout", url: "https://checkout.stripe.test/cs_test_accepted_before_timeout" };
    },
    async persistSession(session) { persistedSessionId = session.sessionId; },
  };

  await assert.rejects(openHostedLessonCheckout(checkoutInput, ports), /connection ended/);
  await openHostedLessonCheckout(checkoutInput, ports);

  assert.deepEqual(idempotencyKeys, [
    `lesson-quick-payment-${checkoutInput.requestId}-v1`,
    `lesson-quick-payment-${checkoutInput.requestId}-v1`,
  ]);
  assert.equal(persistedSessionId, "cs_test_accepted_before_timeout");
});

test("rejects a provider response without a hosted URL before persistence", async () => {
  let persistenceCalls = 0;
  await assert.rejects(openHostedLessonCheckout(checkoutInput, {
    async createSession() { return { id: "cs_test_missing_url", url: null }; },
    async persistSession() { persistenceCalls += 1; },
  }), /did not return a hosted payment URL/);
  assert.equal(persistenceCalls, 0);
});

test("reconciliation retrieves expanded provider state, validates it, and records provider identities", async () => {
  let retrieval;
  let completion;
  const result = await completeHostedLessonCheckout({
    request: { requestId: checkoutInput.requestId, amountCents: 5500, currency: "USD" },
    checkoutSessionId: "cs_test_paid",
    stripeAccount: checkoutInput.stripeAccount,
    providerEventId: "evt_test_paid",
    providerCreatedAt: "2099-01-01T00:10:00.000Z",
  }, {
    async retrieveSession(checkoutSessionId, stripeAccount) {
      retrieval = { checkoutSessionId, stripeAccount };
      return paidSession();
    },
    validateSession: validateCompletedLessonCheckout,
    async completeRequest(value) { completion = value; },
  });

  assert.deepEqual(retrieval, { checkoutSessionId: "cs_test_paid", stripeAccount: checkoutInput.stripeAccount });
  assert.deepEqual(completion, {
    requestId: checkoutInput.requestId,
    checkoutSessionId: "cs_test_paid",
    paymentIntentId: "pi_paid",
    chargeId: "ch_paid",
    providerEventId: "evt_test_paid",
    providerCreatedAt: "2099-01-01T00:10:00.000Z",
  });
  assert.deepEqual(result, { paymentIntentId: "pi_paid", chargeId: "ch_paid" });
});

test("duplicate paid events converge on one succeeded local payment", async () => {
  let localState = "expired";
  let recordedIdentity = null;
  let auditRows = 0;
  const ports = {
    async retrieveSession() { return paidSession(); },
    validateSession: validateCompletedLessonCheckout,
    async completeRequest(value) {
      if (localState === "succeeded") {
        assert.equal(value.paymentIntentId, recordedIdentity.paymentIntentId);
        return;
      }
      assert.ok(["created", "open", "expired"].includes(localState));
      localState = "succeeded";
      recordedIdentity = value;
      auditRows += 1;
    },
  };
  const input = {
    request: { requestId: checkoutInput.requestId, amountCents: 5500, currency: "USD" },
    checkoutSessionId: "cs_test_paid",
    stripeAccount: checkoutInput.stripeAccount,
    providerEventId: "evt_test_paid",
    providerCreatedAt: "2099-01-01T00:10:00.000Z",
  };

  await completeHostedLessonCheckout(input, ports);
  await completeHostedLessonCheckout({ ...input, providerEventId: "evt_test_paid_duplicate" }, ports);

  assert.equal(localState, "succeeded");
  assert.equal(auditRows, 1);
});
