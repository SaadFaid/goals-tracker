import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, assertCategoryOwned } from "../middleware/auth.js";
import { recomputeAndLog } from "./dashboard.js";
import { cleanText, isDotColor, assert, isNonNegativeNumber } from "../validation/validate.js";

const router = Router();
router.use(requireAuth);

router.post("/", async (req, res, next) => {
  try {
    const name = cleanText(req.body.name, 100);
    const dotColor = isDotColor(req.body.dotColor) ? req.body.dotColor : "turquoise";
    assert(name, 400, "Category name is required");

    const max = await prisma.category.aggregate({
      where: { userId: req.user.id },
      _max: { sortOrder: true },
    });
    const sortOrder = (max._max.sortOrder ?? -1) + 1;

    const category = await prisma.category.create({
      data: { userId: req.user.id, name, dotColor, sortOrder },
    });

    const dashboard = await recomputeAndLog(req.user.id);
    return res.status(201).json({ category, dashboard });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const category = await assertCategoryOwned(req.params.id, req.user.id);
    const data = {};
    if (req.body.name !== undefined) {
      const name = cleanText(req.body.name, 100);
      assert(name, 400, "Category name cannot be empty");
      data.name = name;
    }
    if (req.body.dotColor !== undefined) {
      assert(isDotColor(req.body.dotColor), 400, `dotColor must be one of: turquoise, white, pink, purple, blue, orange, green, red, grey, black, yellow`);
      data.dotColor = req.body.dotColor;
    }
    if (req.body.expanded !== undefined) data.expanded = !!req.body.expanded;
    if (req.body.sortOrder !== undefined) {
      assert(isNonNegativeNumber(req.body.sortOrder), 400, "sortOrder must be a non-negative number");
      data.sortOrder = req.body.sortOrder;
    }

    const updated = await prisma.category.update({ where: { id: category.id }, data });
    const dashboard = await recomputeAndLog(req.user.id);
    return res.json({ category: updated, dashboard });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const category = await assertCategoryOwned(req.params.id, req.user.id);
    await prisma.category.delete({ where: { id: category.id } });
    const dashboard = await recomputeAndLog(req.user.id);
    return res.json({ ok: true, dashboard });
  } catch (err) {
    next(err);
  }
});

router.post("/reorder", async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.categoryIds) ? req.body.categoryIds : [];
    const owned = await prisma.category.findMany({
      where: { userId: req.user.id },
      select: { id: true },
    });
    const ownedSet = new Set(owned.map((c) => c.id));
    const toSet = ids.filter((id) => ownedSet.has(id));
    await prisma.$transaction(
      toSet.map((id, i) =>
        prisma.category.update({ where: { id }, data: { sortOrder: i } })
      )
    );
    const dashboard = await recomputeAndLog(req.user.id);
    return res.json({ ok: true, dashboard });
  } catch (err) {
    next(err);
  }
});

export default router;
