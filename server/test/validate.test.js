import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanText, cleanUnit } from "../src/validation/validate.js";

// sanitize-html escapes a bare "&" even with allowedTags: []. Every category
// name in the real profile contains one ("Discipline & Mind"), so the import
// used to store "Discipline &amp; Mind" and the label stopped matching itself.
test("cleanText preserves ampersands instead of escaping them", () => {
  assert.equal(cleanText("Discipline & Mind"), "Discipline & Mind");
  assert.equal(cleanText("a & b & c"), "a & b & c");
  assert.equal(cleanText("100% & rising"), "100% & rising");
});

test("cleanText still strips tags", () => {
  assert.equal(cleanText("<b>bold</b> & x"), "bold & x");
  assert.equal(cleanText("<script>alert(1)</script>ok"), "ok");
  assert.equal(cleanText("  spaced  "), "spaced");
  assert.equal(cleanText(""), "");
  assert.equal(cleanText(undefined), "");
  assert.equal(cleanText(42), "");
  assert.equal(cleanText("x".repeat(200), 10), "x".repeat(10));
});

// CategoryCard renders `{item.target}{item.unit}` with no separator, so the
// leading space in " sessions" is load-bearing. Trimming it turns "5 sessions"
// into "5sessions".
test("cleanUnit keeps leading and trailing spacing", () => {
  assert.equal(cleanUnit(" sessions"), " sessions");
  assert.equal(cleanUnit("sessions"), "sessions");
  assert.equal(cleanUnit("  km  "), "  km  ");
  assert.equal(cleanUnit("& x"), "& x");
  assert.equal(cleanUnit("<b>km</b>"), "km");
  assert.equal(cleanUnit(undefined), "");
});
