import assert from "node:assert/strict";
import test from "node:test";

import {
  assertLessonCheckoutTenantBinding,
  assertLessonPaymentConnectedAccount,
  validateCompletedLessonCheckout,
} from "../src/lib/stripe/lesson-quick-pay-validation.ts";

const request = {
  requestId: "request-1",
  schoolId: "school-1",
  lessonId: "lesson-1",
  amountCents: 5500,
  currency: "USD",
};

function paidSession(overrides = {}) {
  return {
    mode: "payment",
    payment_status: "paid",
    client_reference_id: request.requestId,
    amount_total: request.amountCents,
    currency: "usd",
    metadata: {
      lesson_payment_request_id: request.requestId,
      school_id: request.schoolId,
      lesson_event_id: request.lessonId,
    },
    payment_intent: {
      id: "pi_1",
      status: "succeeded",
      latest_charge: { id: "ch_1", paid: true, amount: request.amountCents, currency: "usd" },
    },
    ...overrides,
  };
}

for (const [name, metadata] of [
  ["missing metadata", null],
  ["wrong request metadata", { lesson_payment_request_id: "request-2", school_id: request.schoolId, lesson_event_id: request.lessonId }],
  ["cross-school metadata", { lesson_payment_request_id: request.requestId, school_id: "school-2", lesson_event_id: request.lessonId }],
  ["cross-school lesson metadata", { lesson_payment_request_id: request.requestId, school_id: request.schoolId, lesson_event_id: "lesson-2" }],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(() => validateCompletedLessonCheckout(request, paidSession({ metadata })), /tenant binding/);
  });
}

test("accepts only the payment request's connected Stripe account", () => {
  assert.doesNotThrow(() => assertLessonPaymentConnectedAccount("acct_school_1", "acct_school_1"));
  assert.throws(() => assertLessonPaymentConnectedAccount("acct_school_1", "acct_school_2"), /connected account does not match/);
  assert.throws(() => assertLessonPaymentConnectedAccount(null, "acct_school_1"), /connected account does not match/);
});

test("the tenant-binding guard is reusable for expiration events", () => {
  const identity = { requestId: request.requestId, schoolId: request.schoolId, lessonId: request.lessonId };
  assert.doesNotThrow(() => assertLessonCheckoutTenantBinding(identity, paidSession()));
  assert.throws(
    () => assertLessonCheckoutTenantBinding(identity, paidSession({
      metadata: {
        lesson_payment_request_id: request.requestId,
        school_id: "school-2",
        lesson_event_id: request.lessonId,
      },
    })),
    /tenant binding/,
  );
});

test("accepts a fully paid Checkout session bound to the local request", () => {
  assert.deepEqual(validateCompletedLessonCheckout(request, paidSession()), {
    paymentIntentId: "pi_1",
    chargeId: "ch_1",
  });
});

for (const [name, override] of [
  ["non-payment mode", { mode: "setup" }],
  ["unpaid session", { payment_status: "unpaid" }],
  ["wrong local request", { client_reference_id: "request-2" }],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(() => validateCompletedLessonCheckout(request, paidSession(override)), /binding or status/);
  });
}

for (const [name, override] of [
  ["wrong amount", { amount_total: 5400 }],
  ["missing amount", { amount_total: null }],
  ["wrong currency", { currency: "eur" }],
  ["missing currency", { currency: null }],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(() => validateCompletedLessonCheckout(request, paidSession(override)), /amount or currency/);
  });
}

test("rejects a non-expanded PaymentIntent", () => {
  assert.throws(() => validateCompletedLessonCheckout(request, paidSession({ payment_intent: "pi_1" })), /intent is not succeeded/);
});

test("rejects an unsuccessful PaymentIntent", () => {
  assert.throws(() => validateCompletedLessonCheckout(request, paidSession({
    payment_intent: { id: "pi_1", status: "processing", latest_charge: null },
  })), /intent is not succeeded/);
});

for (const [name, latestCharge] of [
  ["non-expanded Charge", "ch_1"],
  ["unpaid Charge", { id: "ch_1", paid: false, amount: 5500, currency: "usd" }],
  ["wrong Charge amount", { id: "ch_1", paid: true, amount: 5400, currency: "usd" }],
  ["wrong Charge currency", { id: "ch_1", paid: true, amount: 5500, currency: "eur" }],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(() => validateCompletedLessonCheckout(request, paidSession({
      payment_intent: { id: "pi_1", status: "succeeded", latest_charge: latestCharge },
    })), /charge does not match/);
  });
}
