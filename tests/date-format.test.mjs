import assert from "node:assert/strict";
import test from "node:test";
import { formatCompactDate } from "../src/lib/date-format.ts";

test("formats stored date-only values without timezone drift", () => {
  assert.equal(formatCompactDate("2026-10-01"), "01/10/26");
  assert.equal(formatCompactDate("2026-12-31"), "31/12/26");
});

test("leaves unexpected values visible instead of inventing a date", () => {
  assert.equal(formatCompactDate("October 2026"), "October 2026");
});
