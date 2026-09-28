import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { seedUserCategories, DEFAULT_CATEGORIES } from "./defaultCategories.js";
import { hashPassword } from "../lib/auth.js";
// Pure function (Date + Math only, no browser APIs), so the server can reuse the
// client's generator rather than keep a second copy that would drift.
import { generateGuestLogs } from "../../../src/lib/guestLogs.js";

/**
 * Rebuild an account from what the repo already knows, without an export.
 *
 * Covers the 9 default categories with their actions, results and reward tiers
 * (DEFAULT_CATEGORIES), plus the deterministic year of demo chart history that
 * guest mode generates (generateGuestLogs). Neither needs anything from the
 * browser.
 *
 * What it deliberately does NOT do is the CURRENT month. generateGuestLogs()
 * stops at last month on purpose so past days stay frozen, and the current
 * month's numbers are the one thing that came from the user. Pass them via
 * CURRENT_MONTH_LOGS='[{"dayOfMonth":3,"qualityScore":72}]' to fill that in.
 */

const email = String(process.env.SEED_EMAIL || "").trim().toLowerCase();
const password = process.env.SEED_PASSWORD;
const name = process.env.SEED_NAME || "User";

if (!email || !password) {
  console.error("Set SEED_EMAIL and SEED_PASSWORD");
  process.exit(1);
}

async function upsertLogs(userId, logs) {
  let written = 0;
  for (const l of logs) {
    const date = new Date(Date.UTC(l.year, l.month - 1, l.dayOfMonth));
    if (Number.isNaN(date.getTime())) continue;
    await prisma.progressLog.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId, date,
        year: l.year, month: l.month, dayOfMonth: l.dayOfMonth,
        qualityScore: l.qualityScore,
        expectedScore: l.expectedScore,
        resultsScore: Number.isFinite(l.resultsScore) ? l.resultsScore : null,
      },
      update: {
        qualityScore: l.qualityScore,
        expectedScore: l.expectedScore,
        resultsScore: Number.isFinite(l.resultsScore) ? l.resultsScore : null,
      },
    });
    written++;
  }
  return written;
}

try {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, passwordHash: await hashPassword(password), name },
    });
    console.log(`Created user ${email}`);
  } else {
    console.log(`User ${email} already exists`);
  }

  const haveCats = await prisma.category.count({ where: { userId: user.id } });
  if (haveCats > 0) {
    console.log(`${haveCats} categories already present, leaving them alone (pass --reset to rebuild)`);
  } else {
    await seedUserCategories(prisma, user.id);
    console.log(`Seeded ${DEFAULT_CATEGORIES.length} categories with actions, results and rewards`);
  }

  const past = generateGuestLogs();
  console.log(`Wrote ${await upsertLogs(user.id, past)} past-month log entries`);

  if (process.env.CURRENT_MONTH_LOGS) {
    const now = new Date();
    const parsed = JSON.parse(process.env.CURRENT_MONTH_LOGS);
    const rows = (Array.isArray(parsed) ? parsed : [parsed]).map((l) => ({
      year: Number.isInteger(l.year) ? l.year : now.getFullYear(),
      month: Number.isInteger(l.month) ? l.month : now.getMonth() + 1,
      dayOfMonth: l.dayOfMonth,
      qualityScore: l.qualityScore,
      expectedScore: Number.isFinite(l.expectedScore) ? l.expectedScore : 0,
      resultsScore: l.resultsScore,
    }));
    console.log(`Wrote ${await upsertLogs(user.id, rows)} current-month entries`);
  } else {
    console.log("No CURRENT_MONTH_LOGS set, current month left empty");
  }

  const counts = await Promise.all([
    prisma.category.count({ where: { userId: user.id } }),
    prisma.action.count({ where: { category: { userId: user.id } } }),
    prisma.result.count({ where: { category: { userId: user.id } } }),
    prisma.reward.count({ where: { category: { userId: user.id } } }),
    prisma.progressLog.count({ where: { userId: user.id } }),
  ]);
  console.log(`\ncategories=${counts[0]} actions=${counts[1]} results=${counts[2]} rewards=${counts[3]} logs=${counts[4]}`);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
