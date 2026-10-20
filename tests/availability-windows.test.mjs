import assert from "node:assert/strict";
import test from "node:test";

import { teacherIdsWithAvailabilityOnDates } from "../src/lib/scheduling/availability-windows.ts";

const mondayWeek = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];

test("availability is configured only when a rule applies during the displayed week", () => {
  const rules = [
    { teacher_id: "current", weekday: 1, effective_from: "2026-10-01", effective_until: null },
    { teacher_id: "expired", weekday: 1, effective_from: "2026-09-01", effective_until: "2026-10-18" },
    { teacher_id: "future", weekday: 1, effective_from: "2026-10-26", effective_until: null },
  ];

  assert.deepEqual([...teacherIdsWithAvailabilityOnDates(rules, mondayWeek)], ["current"]);
});

test("a rule must match an actual weekday inside the displayed dates", () => {
  const rules = [{ teacher_id: "saturday", weekday: 6, effective_from: "2026-10-01", effective_until: null }];
  assert.deepEqual([...teacherIdsWithAvailabilityOnDates(rules, mondayWeek.slice(0, 5))], []);
  assert.deepEqual([...teacherIdsWithAvailabilityOnDates(rules, mondayWeek)], ["saturday"]);
});
