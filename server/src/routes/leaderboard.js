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
  const source = clean && clean.toLowerCase() !== "user" ? clean : (email || "").split("@")[0].trim();
  if (!source) return "Anonymous";

  // "Saad Faid" → "Saad F." — a public board shows a first name, not a full one.
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first} ${last[0].toUpperCase()}.`;
}

const DAY_MS = 86400000;
const keyOf = (d) => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

/**
 * Same rule as the client (`src/lib/streak.js`): consecutive active days ending
 * at the most recent one, and a gap of 3 days ends the streak.
 */
export function computeStreak(activity, now = new Date()) {
  const days = new Set(Array.isArray(activity) ? activity : []);
  if (days.size === 0) return 0;

  let last = null;
  const probe = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i <= 400; i += 1) {
    if (days.has(keyOf(probe))) {
      last = new Date(probe);
      break;
    }
    probe.setDate(probe.getDate() - 1);
  }
  if (!last) return 0;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const gap = Math.round((today - last) / DAY_MS);
  if (gap >= 3) return 0;

  let streak = 0;
  const back = new Date(last);
  while (days.has(keyOf(back))) {
    streak += 1;
    back.setDate(back.getDate() - 1);
  }
  return streak;
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
        hideFromLeaderboard: true,
        settings: true,
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
      // Opted-out accounts keep their streak and their data; they just do not
      // appear to anyone else. You can still see your own row.
      .filter((u) => !u.hideFromLeaderboard || u.id === req.user.id)
      .map((u) => {
        const bag = u.settings && typeof u.settings === "object" ? u.settings : {};
        return {
          name: displayName(u.name, u.email),
          percent: Math.max(0, Math.min(100, Math.round(calculateOverallQuality(u.categories)))),
          streak: computeStreak(bag.activity),
          isYou: u.id === req.user.id,
        };
      })
      .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name))
      .map((entry, i) => ({ rank: i + 1, ...entry }));

    return res.json({ entries, total: entries.length });
  } catch (err) {
    next(err);
  }
});

export default router;
