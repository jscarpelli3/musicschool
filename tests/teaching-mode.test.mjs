import assert from "node:assert/strict";
import test from "node:test";

import { soleTeacherId, teachingModeFor } from "../src/lib/schools/teaching-mode.ts";

test("exactly one teacher activates automatic solo conveniences", () => {
  assert.equal(teachingModeFor([{ id: "teacher-one" }]), "solo");
  assert.equal(soleTeacherId([{ id: "teacher-one" }]), "teacher-one");
});

test("zero or multiple teachers retain team choices", () => {
  assert.equal(teachingModeFor([]), "team");
  assert.equal(soleTeacherId([]), undefined);
  assert.equal(teachingModeFor([{ id: "one" }, { id: "two" }]), "team");
  assert.equal(soleTeacherId([{ id: "one" }, { id: "two" }]), undefined);
});
