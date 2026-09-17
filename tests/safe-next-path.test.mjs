import assert from "node:assert/strict";
import test from "node:test";

import { safeNextPath } from "../src/lib/auth/safe-next-path.ts";

const origin = "https://app.commontime.studio";

test("accepts same-origin application paths", () => {
  assert.equal(safeNextPath("/schools/123?view=week#lesson", origin), "/schools/123?view=week#lesson");
});

test("rejects absolute and protocol-relative redirects", () => {
  assert.equal(safeNextPath("https://evil.example/login", origin), "/");
  assert.equal(safeNextPath("//evil.example/login", origin), "/");
});

test("rejects browser-dependent backslash redirects", () => {
  assert.equal(safeNextPath("/\\evil.example/login", origin), "/");
});

test("falls back safely for missing paths and invalid origins", () => {
  assert.equal(safeNextPath(null, origin), "/");
  assert.equal(safeNextPath("/portal", "not an origin"), "/");
});
