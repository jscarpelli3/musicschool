import assert from "node:assert/strict";
import test from "node:test";
import { canAssignedTeacherRevealServiceAddress } from "../src/lib/scheduling/service-location-policy.ts";

const lesson = {
  startsAt: "2026-11-10T16:00:00.000Z",
  endsAt: "2026-11-10T16:30:00.000Z",
  status: "scheduled",
};

test("assigned-teacher address access opens exactly seven days before a lesson", () => {
  assert.equal(canAssignedTeacherRevealServiceAddress({ ...lesson, nowMs: Date.parse("2026-11-03T15:59:59.999Z") }), false);
  assert.equal(canAssignedTeacherRevealServiceAddress({ ...lesson, nowMs: Date.parse("2026-11-03T16:00:00.000Z") }), true);
});

test("assigned-teacher address access closes 48 hours after a lesson", () => {
  assert.equal(canAssignedTeacherRevealServiceAddress({ ...lesson, nowMs: Date.parse("2026-11-12T16:30:00.000Z") }), true);
  assert.equal(canAssignedTeacherRevealServiceAddress({ ...lesson, nowMs: Date.parse("2026-11-12T16:30:00.001Z") }), false);
});

test("cancelled and rescheduled lessons never reveal an address", () => {
  const nowMs = Date.parse("2026-11-10T16:00:00.000Z");
  assert.equal(canAssignedTeacherRevealServiceAddress({ ...lesson, status: "cancelled", nowMs }), false);
  assert.equal(canAssignedTeacherRevealServiceAddress({ ...lesson, status: "rescheduled", nowMs }), false);
});
