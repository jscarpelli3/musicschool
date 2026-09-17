import assert from "node:assert/strict";
import test from "node:test";

import { clockTime, fiveMinuteTimeOptions, minutesFromTime } from "../src/lib/scheduling/time-options.ts";

test("five-minute options cover one full day without duplicates", () => {
  assert.equal(fiveMinuteTimeOptions.length, 288);
  assert.equal(new Set(fiveMinuteTimeOptions.map(({ value }) => value)).size, 288);
  assert.deepEqual(fiveMinuteTimeOptions[0], { value: "00:00", label: "12:00 AM" });
  assert.deepEqual(fiveMinuteTimeOptions.at(-1), { value: "23:55", label: "11:55 PM" });
});

test("time conversion handles noon, midnight, and day wrapping", () => {
  assert.equal(minutesFromTime("13:45"), 825);
  assert.equal(clockTime(0), "12:00 AM");
  assert.equal(clockTime(720), "12:00 PM");
  assert.equal(clockTime(-5), "11:55 PM");
  assert.equal(clockTime(1445), "12:05 AM");
});
