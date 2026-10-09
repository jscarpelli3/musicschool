import assert from "node:assert/strict";
import test from "node:test";
import { calendarMonthCutoff, formatCompactDate } from "../src/lib/date-format.ts";

test("formats stored date-only values without timezone drift", () => {
  assert.equal(formatCompactDate("2026-10-01"), "01/10/26");
  assert.equal(formatCompactDate("2026-12-31"), "31/12/26");
});

test("leaves unexpected values visible instead of inventing a date", () => {
  assert.equal(formatCompactDate("October 2026"), "October 2026");
});

test("subtracts calendar months and clamps month-end dates", () => {
  assert.equal(calendarMonthCutoff("America/Chicago", 6, new Date("2026-08-31T18:00:00Z")), "2026-02-28");
  assert.equal(calendarMonthCutoff("America/Chicago", 6, new Date("2024-08-31T18:00:00Z")), "2024-02-29");
});

test("uses the school's local calendar date at timezone boundaries", () => {
  const instant = new Date("2026-10-10T02:00:00Z");
  assert.equal(calendarMonthCutoff("America/Chicago", 6, instant), "2026-04-09");
  assert.equal(calendarMonthCutoff("Asia/Tokyo", 6, instant), "2026-04-10");
});
