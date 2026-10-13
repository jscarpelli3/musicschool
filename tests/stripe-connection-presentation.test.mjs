import assert from "node:assert/strict";
import test from "node:test";

import { stripeConnectionPresentation } from "../src/lib/stripe/connection-presentation.ts";

const base = {
  connected: true,
  detailsSubmitted: true,
  chargesEnabled: false,
  payoutsEnabled: false,
  requirements: [],
  pendingVerification: [],
  requirementErrors: [],
  disabledReason: null,
};

test("submitted information awaiting verification is presented as under review", () => {
  assert.equal(stripeConnectionPresentation({ ...base, pendingVerification: ["individual.id_number"] }), "under_review");
});

test("a requirement or verification error takes priority over passive review", () => {
  assert.equal(stripeConnectionPresentation({ ...base, requirements: ["external_account"], pendingVerification: ["individual.id_number"] }), "action_required");
  assert.equal(stripeConnectionPresentation({ ...base, requirementErrors: [{ code: "invalid" }] }), "action_required");
});

test("a rejected account is distinct from a remediable requirement", () => {
  assert.equal(stripeConnectionPresentation({ ...base, disabledReason: "rejected.other" }), "not_approved");
});

test("enabled capabilities win over stale requirement data", () => {
  assert.equal(stripeConnectionPresentation({ ...base, chargesEnabled: true, payoutsEnabled: true, requirements: ["stale"] }), "ready");
});

test("unconnected and unfinished accounts remain distinct", () => {
  assert.equal(stripeConnectionPresentation({ ...base, connected: false, detailsSubmitted: false }), "not_connected");
  assert.equal(stripeConnectionPresentation({ ...base, detailsSubmitted: false }), "setup_in_progress");
});
