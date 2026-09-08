import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, assertCategoryOwned, assertOwned } from "../middleware/auth.js";
import { recomputeAndLog } from "./dashboard.js";
import { calculateDashboardState } from "../lib/calc.js";
import { cleanText, isPositiveNumber, assert } from "../validation/validate.js";

const router = Router();
router.use(requireAuth);

router.post("/:catId/rewards", async (req, res, next) => {
  try {
    const category = await assertCategoryOwned(req.params.catId, req.user.id);
    const name = cleanText(req.body.name, 100);
    const cost = req.body.cost;
    assert(name, 400, "Reward name is required");
    assert(isPositiveNumber(cost), 400, "Reward cost must be a positive number");

    let linkedResultId = null;
    if (req.body.linkedResultId) {
      const result = await prisma.result.findFirst({
        where: { id: req.body.linkedResultId, categoryId: category.id },
      });
      if (!result) linkedResultId = null; // invalid link -> unlink, not error per spec? guard on claim
      else linkedResultId = result.id;
    }

    let linkedActionId = null;
    if (req.body.linkedActionId) {
      const action = await prisma.action.findFirst({
        where: { id: req.body.linkedActionId, categoryId: category.id },
      });
      if (action) linkedActionId = action.id;
    }

    const allowedTypes = ["score", "revenue", "daily", "weekly", "action", "result"];
    let thresholdType = allowedTypes.includes(req.body.thresholdType) ? req.body.thresholdType : "score";
    if (req.body.linkedActionId) thresholdType = (thresholdType === "score" || req.body.thresholdType == null) ? "action" : thresholdType;
    if (req.body.linkedResultId) thresholdType = thresholdType === "score" ? "result" : thresholdType;

    const reward = await prisma.reward.create({
      data: {
        categoryId: category.id,
        name,
        cost,
        thresholdType,
        period: ["daily", "weekly", "monthly"].includes(req.body.period)
          ? req.body.period
          : "monthly",
        linkedResultId,
        linkedActionId,
        linkedPercent: isPositiveNumber(req.body.linkedPercent) ? req.body.linkedPercent : null,
      },
    });
    const dashboard = await recomputeAndLog(req.user.id);
    return res.status(201).json({ reward, dashboard });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const reward = await assertOwned("reward", req.params.id, req.user.id);
    const data = {};
    if (req.body.name !== undefined) {
      const name = cleanText(req.body.name, 100);
      assert(name, 400, "Reward name cannot be empty");
      data.name = name;
    }
    if (req.body.cost !== undefined) {
      assert(isPositiveNumber(req.body.cost), 400, "cost must be positive");
      data.cost = req.body.cost;
    }
    if (req.body.linkedResultId !== undefined) {
      const result = await prisma.result.findFirst({
        where: { id: req.body.linkedResultId, categoryId: reward.categoryId },
      });
      data.linkedResultId = result ? result.id : null;
      if (result) data.linkedActionId = null; // mutually exclusive single-link
    }
    if (req.body.linkedActionId !== undefined) {
      const action = await prisma.action.findFirst({
        where: { id: req.body.linkedActionId, categoryId: reward.categoryId },
      });
      data.linkedActionId = action ? action.id : null;
      if (action) data.linkedResultId = null; // mutually exclusive single-link
    }
    if (req.body.linkedPercent !== undefined) {
      data.linkedPercent = isPositiveNumber(req.body.linkedPercent) ? req.body.linkedPercent : null;
    }
    if (req.body.thresholdType !== undefined) {
      data.thresholdType = ["score", "revenue", "daily", "weekly", "action", "result"].includes(req.body.thresholdType)
        ? req.body.thresholdType
        : "score";
    }
    if (req.body.period !== undefined && ["daily", "weekly", "monthly"].includes(req.body.period)) {
      data.period = req.body.period;
    }
    const updated = await prisma.reward.update({ where: { id: reward.id }, data });
    const dashboard = await recomputeAndLog(req.user.id);
    return res.json({ reward: updated, dashboard });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const reward = await assertOwned("reward", req.params.id, req.user.id);
    await prisma.reward.delete({ where: { id: reward.id } });
    const dashboard = await recomputeAndLog(req.user.id);
    return res.json({ ok: true, dashboard });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/claim", async (req, res, next) => {
  try {
    const reward = await assertOwned("reward", req.params.id, req.user.id);
    if (reward.claimed) return res.status(409).json({ error: "Reward already claimed" });

    const categories = await prisma.category.findMany({
      where: { userId: req.user.id },
      orderBy: { sortOrder: "asc" },
      include: {
        actions: { orderBy: { sortOrder: "asc" } },
        results: { orderBy: { sortOrder: "asc" } },
        rewards: true,
      },
    });
    const state = calculateDashboardState(categories, new Date(), 0);

    if (reward.thresholdType === "daily" || reward.thresholdType === "weekly") {
      const resetType = reward.thresholdType;
      const goals = categories
        .filter((c) => c.isRewards !== true)
        .flatMap((c) => (c.actions || []).filter((a) => a.resetType === resetType));
      if (goals.length === 0 || !goals.every((a) => a.current >= a.target)) {
        throw Object.assign(new Error("Threshold not met"), { status: 400 });
      }
    } else if (reward.thresholdType === "action" && reward.linkedActionId) {
      const action = await prisma.action.findUnique({ where: { id: reward.linkedActionId } });
      if (!action) throw Object.assign(new Error("Linked task no longer exists"), { status: 400 });
      const pct = action.target > 0 ? Math.min((action.current / action.target) * 100, 100) : 0;
      const threshold = reward.linkedPercent ?? 100;
      if (pct < threshold) {
        throw Object.assign(new Error("Threshold not met"), { status: 400 });
      }
    } else if (reward.linkedResultId) {
      const result = await prisma.result.findUnique({ where: { id: reward.linkedResultId } });
      if (!result) throw Object.assign(new Error("Linked metric no longer exists"), { status: 400 });
      const pct = result.target > 0 ? (result.current / result.target) * 100 : 0;
      const threshold = reward.linkedPercent ?? 100;
      if (pct < threshold) {
        throw Object.assign(new Error("Threshold not met"), { status: 400 });
      }
    } else if (reward.thresholdType === "revenue") {
      const finance = categories.find((c) => c.name?.toLowerCase().includes("finance"));
      const dollar = (finance?.results || []).find((r) => r.unit === "$");
      const revenue = dollar ? dollar.current : 0;
      if (revenue < reward.cost) {
        throw Object.assign(new Error("Threshold not met"), { status: 400 });
      }
    } else {
      if (state.stats.qualityPercent < reward.cost) {
        throw Object.assign(new Error("Threshold not met"), { status: 400 });
      }
    }

    const claimed = await prisma.reward.update({
      where: { id: reward.id },
      data: { claimed: true, claimedAt: new Date() },
    });

    const dashboard = await recomputeAndLog(req.user.id);
    return res.json({ reward: claimed, dashboard });
  } catch (err) {
    next(err);
  }
});

export default router;
