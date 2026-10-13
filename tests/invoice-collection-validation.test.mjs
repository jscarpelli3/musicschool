import assert from "node:assert/strict";
import test from "node:test";
import { assertInvoicePaymentIntentBinding } from "../src/lib/stripe/invoice-collection-validation.ts";

const attempt = { attemptId: "attempt-1", schoolId: "school-1", billingAccountId: "family-1", billingPeriodId: "period-1", amountCents: 200, currency: "USD", stripeAccount: "acct_1", stripeCustomer: "cus_1", stripePaymentMethod: "pm_1" };
const intent = { amount: 200, currency: "usd", customer: "cus_1", paymentMethod: "pm_1", metadata: { payment_attempt_id: "attempt-1", school_id: "school-1", billing_account_id: "family-1", billing_period_id: "period-1" } };

test("accepts an exact invoice PaymentIntent binding", () => assert.doesNotThrow(() => assertInvoicePaymentIntentBinding(attempt, "acct_1", intent)));

for (const [name, account, override] of [
  ["connected account", "acct_other", {}],
  ["amount", "acct_1", { amount: 201 }],
  ["currency", "acct_1", { currency: "eur" }],
  ["customer", "acct_1", { customer: "cus_other" }],
  ["payment method", "acct_1", { paymentMethod: "pm_other" }],
  ["tenant metadata", "acct_1", { metadata: { ...intent.metadata, school_id: "school-other" } }],
]) test(`rejects a mismatched ${name}`, () => assert.throws(() => assertInvoicePaymentIntentBinding(attempt, account, { ...intent, ...override }), /does not match/));
