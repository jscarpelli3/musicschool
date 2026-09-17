import assert from "node:assert/strict";
import test from "node:test";

import {
  billingPeriodDescriptor,
  deliveryDescriptor,
  isLessonProposalState,
  lessonProposalDescriptor,
} from "../src/lib/domain/state-descriptors.ts";

test("pending proposals remain reviewable and non-terminal", () => {
  assert.deepEqual(lessonProposalDescriptor("pending_owner"), {
    label: "Waiting for school review",
    terminal: false,
    tone: "warning",
    reviewable: true,
  });
});

test("terminal and editable billing states stay distinct", () => {
  assert.equal(billingPeriodDescriptor("draft").editable, true);
  assert.equal(billingPeriodDescriptor("paid").terminal, true);
  assert.equal(billingPeriodDescriptor("paid").editable, undefined);
});

test("uncertain delivery never masquerades as terminal failure or success", () => {
  assert.deepEqual(deliveryDescriptor("reconciliation_required"), {
    label: "Delivery uncertain",
    terminal: false,
    tone: "warning",
  });
});

test("unknown persisted states fail closed", () => {
  assert.equal(isLessonProposalState("made_up_state"), false);
  assert.throws(() => billingPeriodDescriptor("made_up_state"), /Unsupported billing period state/);
});
