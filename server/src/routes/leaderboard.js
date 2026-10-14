import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { calculateOverallQuality } from "../lib/calc.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// A "User" default name is the schema default, so without a fallback every new
// account would show up in the board as an identical "User". Fall back to the
// local part of the email (never the domain) so rows stay distinguishable.
function displayName(name, email) {
  const clean = (name || "").trim();
  if (clean && clean.toLowerCase() !== "user") return clean;
  const local = (email || "").split("@")[0].trim();
  return local || "Anonymous";
}

/**
 * Every account ranked by progress, best first.
 *
 * The metric is the same overall-quality number the dashboard headlines, so a
 * row here matches the percentage that user sees on their own screen. Only the
 * display name and the score leave the server — no emails, no ids.
 */
router.get("/", async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        categories: {
          select: {
            actions: { select: { weight: true, current: true, target: true } },
            results: { select: { weight: true, current: true, target: true, invert: true } },
          },
        },
      },
      take: 500,
    });

    const entries = users
      .map((u) => ({
        name: displayName(u.name, u.email),
        percent: Math.max(0, Math.min(100, Math.round(calculateOverallQuality(u.categories)))),
        isYou: u.id === req.user.id,
      }))
      .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name))
      .map((entry, i) => ({ rank: i + 1, ...entry }));

    return res.json({ entries, total: entries.length });
  } catch (err) {
    next(err);
  }
});

export default router;
