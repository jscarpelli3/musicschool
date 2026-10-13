import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_APP_ORIGIN,
  PRODUCTION_EMAIL_SAFETY_SENTENCE,
  STAGING_EMAIL_SAFETY_SENTENCE,
  resolveEmailDeliveryPolicy,
} from "../src/lib/resend/email-delivery-policy.ts";

test("production email policy permits only the canonical application origin", () => {
  const policy = resolveEmailDeliveryPolicy({ nodeEnvironment: "production", vercelEnvironment: "production" });
  assert.deepEqual([...policy.allowedOrigins], [CANONICAL_APP_ORIGIN]);
  assert.equal(policy.allowedRecipients, null);
  assert.equal(policy.safetySentence, PRODUCTION_EMAIL_SAFETY_SENTENCE);
});

test("preview allowlist policy permits the staging and canonical origins for named recipients", () => {
  const policy = resolveEmailDeliveryPolicy({
    deliveryMode: "allowlist",
    allowedRecipients: " Owner@Example.com, teacher@example.com ",
    appUrl: "https://staging.example.com/path",
    vercelEnvironment: "preview",
    nodeEnvironment: "production",
  });
  assert.deepEqual([...policy.allowedOrigins], [CANONICAL_APP_ORIGIN, "https://staging.example.com"]);
  assert.deepEqual([...policy.allowedRecipients ?? []], ["owner@example.com", "teacher@example.com"]);
  assert.equal(policy.safetySentence, STAGING_EMAIL_SAFETY_SENTENCE);
});

test("allowlist mode fails closed in production", () => {
  assert.throws(() => resolveEmailDeliveryPolicy({
    deliveryMode: "allowlist",
    allowedRecipients: "owner@example.com",
    appUrl: "https://staging.example.com",
    vercelEnvironment: "production",
    nodeEnvironment: "production",
  }), /only in preview or local/);
});

test("allowlist mode requires an explicit valid recipient and origin", () => {
  assert.throws(() => resolveEmailDeliveryPolicy({ deliveryMode: "allowlist", vercelEnvironment: "preview", appUrl: "not-a-url" }), /valid staging APP_URL/);
  assert.throws(() => resolveEmailDeliveryPolicy({ deliveryMode: "allowlist", vercelEnvironment: "preview", appUrl: "https://staging.example.com" }), /at least one valid recipient/);
});
