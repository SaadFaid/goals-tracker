import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedUserCategories, DEFAULT_CATEGORIES } from "./defaultCategories.js";
import { hashPassword } from "../lib/auth.js";

const prisma = new PrismaClient();

async function backfillRewards(prisma) {
  const template = DEFAULT_CATEGORIES.find((c) => c.isRewards);
  const users = await prisma.user.findMany({ select: { id: true } });
  let filled = 0;
  for (const { id } of users) {
    const cat = await prisma.category.findFirst({
      where: { userId: id, name: "Rewards" },
      include: { rewards: true },
    });
    if (!cat || cat.rewards.length > 0) continue;
    await prisma.reward.createMany({
      data: template.rewards.map((r) => ({
        categoryId: cat.id,
        name: r.name,
        cost: r.cost,
        thresholdType: r.thresholdType || "score",
        period: r.period || "monthly",
        linkedResultId: r.linkedResultId || null,
      })),
    });
    filled++;
  }
  console.log(filled > 0 ? `Backfilled reward tiers for ${filled} user(s)` : "Reward tiers already present for all users");
}

async function main() {
  const email = process.env.SEED_EMAIL || "demo@augustgoals.dev";
  const password = process.env.SEED_PASSWORD || "DemoPass1!";
  const name = process.env.SEED_NAME || "Demo";

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await hashPassword(password);
    user = await prisma.user.create({
      data: { email, passwordHash, name },
    });
    console.log(`Created user ${email}`);
  } else {
    console.log(`User ${email} already exists`);
  }

  const existingCount = await prisma.category.count({ where: { userId: user.id } });
  if (existingCount > 0) {
    console.log(`User already has ${existingCount} categories. Skipping seed.`);
  } else {
    await seedUserCategories(prisma, user.id);
    console.log(`Seeded ${DEFAULT_CATEGORIES.length} default categories`);
  }

  await backfillRewards(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
