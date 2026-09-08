import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, assertCategoryOwned, assertOwned } from "../middleware/auth.js";
import { recomputeAndLog } from "./dashboard.js";
import { ensureWeightsSum100 } from "../lib/weights.js";
import { cleanText, isWeight, isPositiveNumber, isNonNegativeNumber, assert } from "../validation/validate.js";

const router = Router();
router.use(requireAuth);

router.post("/:catId/actions", async (req, res, next) => {
  try {
    const category = await assertCategoryOwned(req.params.catId, req.user.id);

    const label = cleanText(req.body.label, 100);
    const weight = req.body.weight;
    const target = req.body.target;
    assert(label, 400, "Action label is required");
    assert(isWeight(weight), 400, "Action weight must be an integer 0-100");
    assert(isPositiveNumber(target), 400, "Action target must be a positive number");

    const current = isNonNegativeNumber(req.body.current) ? req.body.current : 0;
    const unit = cleanText(req.body.unit, 50) || null;
    const incrementBy = isPositiveNumber(req.body.incrementBy) ? req.body.incrementBy : 1;
    const resetType = ["none", "daily", "weekly", "monthly", "yearly"].includes(req.body.resetType)
      ? req.body.resetType
      : "monthly";
    const actionType = ["check", "amount", "count"].includes(req.body.actionType) ? req.body.actionType : "count";

    const max = await prisma.action.aggregate({
      where: { categoryId: category.id },
      _max: { sortOrder: true },
    });
    const sortOrder = (max._max.sortOrder ?? -1) + 1;

    const action = await prisma.action.create({
      data: { categoryId: category.id, label, weight, current, target, unit, incrementBy, resetType, actionType, sortOrder },
    });

    // Re-validate weights (allow autoNormalize to fix drift)
    const autoNormalize = req.body.autoNormalize === true;
    await ensureWeightsSum100(category.id, { autoNormalize });

    const dashboard = await recomputeAndLog(req.user.id);
    return res.status(201).json({ action, dashboard });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const action = await assertOwned("action", req.params.id, req.user.id);
    const data = {};
    let weightChanged = false;

    if (req.body.label !== undefined) {
      const label = cleanText(req.body.label, 100);
      assert(label, 400, "Action label cannot be empty");
      data.label = label;
    }
    if (req.body.weight !== undefined) {
      assert(isWeight(req.body.weight), 400, "Action weight must be an integer 0-100");
      data.weight = req.body.weight;
      weightChanged = true;
    }
    if (req.body.current !== undefined) {
      assert(isNonNegativeNumber(req.body.current), 400, "current must be a non-negative number");
      data.current = req.body.current;
    }
    if (req.body.target !== undefined) {
      assert(isPositiveNumber(req.body.target), 400, "target must be a positive number");
      data.target = req.body.target;
    }
    if (req.body.unit !== undefined) {
      data.unit = cleanText(req.body.unit, 50) || null;
    }
    if (req.body.incrementBy !== undefined) {
      assert(isPositiveNumber(req.body.incrementBy), 400, "incrementBy must be a positive number");
      data.incrementBy = req.body.incrementBy;
    }
    if (req.body.resetType !== undefined) {
      assert(["none", "daily", "weekly", "monthly", "yearly"].includes(req.body.resetType), 400, "resetType must be none|daily|weekly|monthly|yearly");
      data.resetType = req.body.resetType;
    }
    if (req.body.actionType !== undefined) {
      assert(["check", "amount", "count"].includes(req.body.actionType), 400, "actionType must be check|amount|count");
      data.actionType = req.body.actionType;
    }
    if (req.body.lastResetAt !== undefined) {
      data.lastResetAt = req.body.lastResetAt ? new Date(req.body.lastResetAt) : null;
    }
    if (req.body.sortOrder !== undefined) {
      assert(isNonNegativeNumber(req.body.sortOrder), 400, "sortOrder must be non-negative");
      data.sortOrder = req.body.sortOrder;
    }

    const updated = await prisma.action.update({ where: { id: action.id }, data });

    if (weightChanged) {
      const autoNormalize = req.body.autoNormalize === true;
      await ensureWeightsSum100(action.categoryId, { autoNormalize });
    }

    const dashboard = await recomputeAndLog(req.user.id);
    return res.json({ action: updated, dashboard });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const action = await assertOwned("action", req.params.id, req.user.id);
    await prisma.action.delete({ where: { id: action.id } });
    const dashboard = await recomputeAndLog(req.user.id);
    return res.json({ ok: true, dashboard });
  } catch (err) {
    next(err);
  }
});

export default router;
