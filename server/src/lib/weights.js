import { prisma } from "./prisma.js";
import { createHttpError } from "../validation/validate.js";

/** Load all actions of a category, ordered. */
export async function getCategoryActions(categoryId) {
  return prisma.action.findMany({
    where: { categoryId },
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * Pure: normalize a list of weights to sum exactly 100 using largest-remainder
 * rounding. Preserves relative proportions. Assumes at least one entry and
 * sum > 0. Returns the normalized integer weights array.
 */
export function normalizeWeights(weights) {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (weights.length === 0 || sum === 0) return weights.slice();
  if (sum === 100 && weights.every((w) => Number.isInteger(w))) return weights.slice();

  const raw = weights.map((w) => (w / sum) * 100);
  const floored = raw.map(Math.floor);
  let remainder = 100 - floored.reduce((s, v) => s + v, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((x, y) => y.frac - x.frac);

  for (let k = 0; k < Math.abs(remainder); k++) {
    floored[order[k % order.length].i] += Math.sign(remainder);
  }
  return floored;
}

/**
 * Validate that action weights in a category sum to 100.
 * If autoNormalize is true, redistribute the difference proportionally
 * (rounding to integers via largest remainder so the sum is exactly 100).
 * Returns updated category actions.
 */
export async function ensureWeightsSum100(categoryId, { autoNormalize = false } = {}) {
  const actions = await getCategoryActions(categoryId);
  const sum = actions.reduce((s, a) => s + (a.weight || 0), 0);

  if (sum === 100) return { actions, currentSum: sum };

  if (!autoNormalize) {
    const err = createHttpError(400, "Weights must sum to 100%");
    err.currentSum = sum;
    throw err;
  }

  if (actions.length === 0) return { actions, currentSum: sum };

  const normalized = normalizeWeights(actions.map((a) => a.weight || 0));

  await prisma.$transaction(
    actions.map((a, i) =>
      prisma.action.update({ where: { id: a.id }, data: { weight: normalized[i] } })
    )
  );

  const updated = await getCategoryActions(categoryId);
  return { actions: updated, currentSum: updated.reduce((s, a) => s + a.weight, 0) };
}

export function weightsSum(actions) {
  return (actions || []).reduce((s, a) => s + (a.weight || 0), 0);
}
