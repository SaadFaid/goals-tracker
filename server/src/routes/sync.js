import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { recomputeAndLog } from "./dashboard.js";
import { cleanText, isDotColor, isWeight, isPositiveNumber, isNonNegativeNumber } from "../validation/validate.js";

const router = Router();
router.use(requireAuth);

/**
 * Merge a full local payload (from guest mode) into the authenticated user's data.
 * Strategy: for each category in the payload, upsert by matching name OR id.
 * Nested actions/results/rewards are matched by id when present, else appended.
 */
router.post("/", async (req, res, next) => {
  const { mode = "merge" } = req.body;
  const payload = Array.isArray(req.body.categories) ? req.body.categories : [];
  try {
    const existing = await prisma.category.findMany({
      where: { userId: req.user.id },
      include: { actions: true, results: true, rewards: true },
    });

    if (mode === "discard") {
      const dashboard = await recomputeAndLog(req.user.id);
      return res.json({ ok: true, dashboard });
    }

    // merge mode
    let sortOrder = existing.length;
    for (const localCat of payload) {
      const name = cleanText(localCat.name, 100);
      if (!name) continue;

      let dbCat = existing.find((c) => c.id === localCat.id || c.name === name);
      if (!dbCat) {
        dbCat = await prisma.category.create({
          data: {
            userId: req.user.id,
            name,
            dotColor: isDotColor(localCat.dotColor) ? localCat.dotColor : "turquoise",
            sortOrder: sortOrder++,
            expanded: localCat.expanded !== false,
          },
        });
        existing.push(dbCat);
      }

      // Actions
      for (const a of localCat.actions || []) {
        const label = cleanText(a.label, 100);
        if (!label || !isWeight(a.weight) || !isPositiveNumber(a.target)) continue;
        const existingAction = dbCat.actions.find((x) => x.id === a.id || (x.label === label && x.target === a.target));
        if (existingAction) {
          await prisma.action.update({
            where: { id: existingAction.id },
            data: {
              current: isNonNegativeNumber(a.current) ? a.current : existingAction.current,
            },
          });
        } else {
          const max = dbCat.actions.length;
          await prisma.action.create({
            data: {
              categoryId: dbCat.id, label, weight: a.weight,
              current: isNonNegativeNumber(a.current) ? a.current : 0,
              target: a.target, unit: cleanText(a.unit, 50) || null, sortOrder: max,
            },
          });
        }
      }

      // Results
      for (const r of localCat.results || []) {
        const label = cleanText(r.label, 100);
        if (!label || !isPositiveNumber(r.target)) continue;
        const existingResult = dbCat.results.find((x) => x.id === r.id || (x.label === label && x.target === r.target));
        if (existingResult) {
          await prisma.result.update({
            where: { id: existingResult.id },
            data: { current: isNonNegativeNumber(r.current) ? r.current : existingResult.current },
          });
        } else {
          await prisma.result.create({
            data: {
              categoryId: dbCat.id, label,
              current: isNonNegativeNumber(r.current) ? r.current : 0,
              target: r.target, unit: cleanText(r.unit, 50) || null, sortOrder: dbCat.results.length,
            },
          });
        }
      }

      // Rewards
      for (const rw of localCat.rewards || []) {
        const nameReward = cleanText(rw.name, 100);
        if (!nameReward || !isPositiveNumber(rw.cost)) continue;
        const existingReward = dbCat.rewards.find((x) => x.id === rw.id || x.name === nameReward);
        if (!existingReward) {
          await prisma.reward.create({
            data: { categoryId: dbCat.id, name: nameReward, cost: rw.cost, claimed: !!rw.claimed },
          });
        }
      }
    }

    const dashboard = await recomputeAndLog(req.user.id);
    return res.json({ ok: true, dashboard });
  } catch (err) {
    next(err);
  }
});

export default router;
