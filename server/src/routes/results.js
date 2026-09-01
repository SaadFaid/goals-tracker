import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, assertCategoryOwned, assertOwned } from "../middleware/auth.js";
import { recomputeAndLog } from "./dashboard.js";
import { cleanText, isPositiveNumber, isNonNegativeNumber, assert } from "../validation/validate.js";

const router = Router();
router.use(requireAuth);

router.post("/:catId/results", async (req, res, next) => {
  try {
    const category = await assertCategoryOwned(req.params.catId, req.user.id);

    const label = cleanText(req.body.label, 100);
    const target = req.body.target;
    assert(label, 400, "Result label is required");
    assert(isPositiveNumber(target), 400, "Result target must be a positive number");

    const current = isNonNegativeNumber(req.body.current) ? req.body.current : 0;
    const unit = cleanText(req.body.unit, 50) || null;

    const max = await prisma.result.aggregate({
      where: { categoryId: category.id },
      _max: { sortOrder: true },
    });
    const sortOrder = (max._max.sortOrder ?? -1) + 1;

    const result = await prisma.result.create({
      data: { categoryId: category.id, label, current, target, unit, sortOrder },
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
