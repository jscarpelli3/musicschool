import assert from "node:assert/strict";
import test from "node:test";

import { normalizeE164 } from "../src/lib/phone.ts";

test("normalizes common North American phone formats", () => {
  assert.equal(normalizeE164("(312) 555-0199"), "+13125550199");
  assert.equal(normalizeE164("1-312-555-0199"), "+13125550199");
});

test("preserves valid international country codes", () => {
  assert.equal(normalizeE164("+44 20 7946 0958"), "+442079460958");
});

test("rejects implausible phone numbers", () => {
  assert.equal(normalizeE164("555-12"), null);
  assert.equal(normalizeE164(""), null);
});
