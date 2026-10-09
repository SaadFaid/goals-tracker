import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, assertCategoryOwned, assertOwned } from "../middleware/auth.js";
import { recomputeAndLog } from "./dashboard.js";
import { cleanText, isPositiveNumber, isNonNegativeNumber, isWeight, assert, createHttpError } from "../validation/validate.js";

const router = Router();
router.use(requireAuth);

// Persist a drag-reorder of the results inside one category. Scoped to the
// category for the same reason as the action equivalent: a stale client must not
// be able to renumber rows it does not own just by knowing their ids.
//
// Like the action router this one is mounted twice, so answer only on the
// canonical /api/results/reorder and pass the other mount through.
router.post("/reorder", async (req, res, next) => {
  if (req.baseUrl !== "/api/results") return next("router");
  try {
    const { categoryId, resultIds } = req.body || {};
    if (!categoryId || typeof categoryId !== "string") {
      assert(false, 400, "categoryId is required");
    }
    const category = await assertCategoryOwned(categoryId, req.user.id);
    const ids = Array.isArray(resultIds) ? resultIds.filter((x) => typeof x === "string") : [];
    if (ids.length === 0) assert(false, 400, "resultIds must be a non-empty array");

    const owned = await prisma.result.findMany({
      where: { categoryId: category.id },
      select: { id: true },
    });
    const ownedSet = new Set(owned.map((r) => r.id));
    const toSet = ids.filter((id) => ownedSet.has(id));

    await prisma.$transaction(
      toSet.map((id, i) => prisma.result.update({ where: { id }, data: { sortOrder: i } })),
    );
    const dashboard = await recomputeAndLog(req.user.id);
    return res.json({ ok: true, dashboard });
  } catch (err) {
    next(err);
  }
});

router.post("/:catId/results", async (req, res, next) => {
  try {
    const category = await assertCategoryOwned(req.params.catId, req.user.id);

    const label = cleanText(req.body.label, 100);
    const target = req.body.target;
    assert(label, 400, "Result label is required");
    assert(isPositiveNumber(target), 400, "Result target must be a positive number");

    const current = isNonNegativeNumber(req.body.current) ? req.body.current : 0;
    const unit = cleanText(req.body.unit, 50) || null;
    // weight/invert/isBadge are real columns but were never read here, so a
    // result created with a weight or as a check/badge came back with the
    // server defaults on the next load and looked like the edit was lost.
    const weight = isWeight(req.body.weight) ? req.body.weight : 0;
    const invert = req.body.invert === true;
    const isBadge = req.body.isBadge === true;

    // Client-minted id so later edits by that id hit the real row (see actions).
    const id = typeof req.body.id === "string" && req.body.id && req.body.id.length <= 100 ? req.body.id : null;
    if (id) {
      const existing = await prisma.result.findUnique({ where: { id } });
      if (existing) {
        if (existing.categoryId !== category.id) throw createHttpError(400, "Result id already in use");
        const dashboard = await recomputeAndLog(req.user.id);
        return res.status(201).json({ result: existing, dashboard });
      }
    }

    const max = await prisma.result.aggregate({
      where: { categoryId: category.id },
      _max: { sortOrder: true },
    });
    const sortOrder = (max._max.sortOrder ?? -1) + 1;

    const result = await prisma.result.create({
      data: { ...(id ? { id } : {}), categoryId: category.id, label, current, target, unit, weight, invert, isBadge, sortOrder },
    });

    const dashboard = await recomputeAndLog(req.user.id);
    return res.status(201).json({ result, dashboard });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const result = await assertOwned("result", req.params.id, req.user.id);
    const data = {};
    if (req.body.label !== undefined) {
      const label = cleanText(req.body.label, 100);
      assert(label, 400, "Result label cannot be empty");
      data.label = label;
    }
    if (req.body.current !== undefined) {
      assert(isNonNegativeNumber(req.body.current), 400, "current must be non-negative");
      data.current = req.body.current;
    }
    if (req.body.target !== undefined) {
      assert(isPositiveNumber(req.body.target), 400, "target must be positive");
      data.target = req.body.target;
    }
    if (req.body.unit !== undefined) data.unit = cleanText(req.body.unit, 50) || null;
    if (req.body.weight !== undefined) {
      assert(isWeight(req.body.weight), 400, "Result weight must be an integer 0-100");
      data.weight = req.body.weight;
    }
    if (req.body.invert !== undefined) data.invert = !!req.body.invert;
    if (req.body.isBadge !== undefined) data.isBadge = !!req.body.isBadge;
    if (req.body.sortOrder !== undefined) {
      assert(isNonNegativeNumber(req.body.sortOrder), 400, "sortOrder must be non-negative");
      data.sortOrder = req.body.sortOrder;
    }

    const updated = await prisma.result.update({ where: { id: result.id }, data });
    const dashboard = await recomputeAndLog(req.user.id);
    return res.json({ result: updated, dashboard });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const result = await assertOwned("result", req.params.id, req.user.id);
    await prisma.result.delete({ where: { id: result.id } });
    const dashboard = await recomputeAndLog(req.user.id);
    return res.json({ ok: true, dashboard });
  } catch (err) {
    next(err);
  }
});

export default router;
