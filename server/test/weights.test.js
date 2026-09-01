import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWeights } from "../src/lib/weights.js";

function sum(arr) {
  return arr.reduce((s, v) => s + v, 0);
}

test("normalize already-100 integers unchanged", () => {
  const w = [40, 30, 30];
  const out = normalizeWeights(w);
  assert.deepEqual(out, w);
  assert.equal(sum(out), 100);
});

test("normalize scales 85 to 100 largest-remainder", () => {
  // [40,30,15] = 85 -> scale up proportionally
  const out = normalizeWeights([40, 30, 15]);
  assert.equal(sum(out), 100);
});

test("normalize handles non-integer totals", () => {
  const out = normalizeWeights([50, 33, 17]);
  assert.equal(sum(out), 100);
  // every value integer
  assert.ok(out.every((v) => Number.isInteger(v)));
});

test("empty and zero inputs are safe", () => {
  assert.deepEqual(normalizeWeights([]), []);
  assert.deepEqual(normalizeWeights([0, 0]), [0, 0]);
});
