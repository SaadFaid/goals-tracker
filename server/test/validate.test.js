import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanText, cleanUnit } from "../src/validation/validate.js";

// sanitize-html escapes a bare "&" and ">" while serializing, even with
// allowedTags: []. Every category name in the real profile contains one
// ("Discipline & Mind"), and one note read "nq 9->18", so the import stored
// "Discipline &amp; Mind" and "nq 9-&gt;18".
test("cleanText preserves ampersands and angle brackets", () => {
  assert.equal(cleanText("Discipline & Mind"), "Discipline & Mind");
  assert.equal(cleanText("a & b & c"), "a & b & c");
  assert.equal(cleanText("100% & rising"), "100% & rising");
  assert.equal(cleanText("nq 9->18 1h30min15min ->1min"), "nq 9->18 1h30min15min ->1min");
  assert.equal(cleanText("5 > 3 and 2 < 4"), "5 > 3 and 2 < 4");
  assert.equal(cleanText("café & tea"), "café & tea");
});

test("cleanText decodes numeric entities", () => {
  assert.equal(cleanText("&#x1F600; emoji"), "\u{1F600} emoji");
});

// Decoding is a single pass, so text the user genuinely typed as an entity
// collapses one level instead of being escaped twice.
test("cleanText decodes entities exactly one level", () => {
  assert.equal(cleanText("&amp;amp;"), "&amp;");
  assert.equal(cleanText("&amp;"), "&");
  assert.equal(cleanText("&gt;"), ">");
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
