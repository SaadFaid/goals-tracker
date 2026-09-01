import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { generateRewardTiers } from "./defaultCategories.js";

const prisma = new PrismaClient();

// Refresh reward tiers on the Rewards card of every account so all users see
// the same current generated set. Claimed rewards are preserved (matched by
// cost + name); everything unclaimed is replaced with the fresh tiers.
async function refreshRewardsForAllAccounts() {
  const users = await prisma.user.findMany({ select: { id: true } });
  const tiers = generateRewardTiers();
  let refreshed = 0;
  let created = 0;

  for (const { id } of users) {
    const cat = await prisma.category.findFirst({
      where: { userId: id, name: "Rewards" },
      include: { rewards: true },
    });
    if (!cat) continue;

    const claimedKeys = new Set(
      cat.rewards.filter((r) => r.claimed).map((r) => `${r.cost}|${r.name}`)
    );
    const tiersToCreate = tiers.filter((t) => !claimedKeys.has(`${t.cost}|${t.name}`));

    await prisma.$transaction([
      prisma.reward.deleteMany({ where: { categoryId: cat.id, claimed: false } }),
      ...tiersToCreate.map((t) =>
        prisma.reward.create({
          data: {
            categoryId: cat.id,
            name: t.name,
            cost: t.cost,
            thresholdType: t.thresholdType || "score",
            period: t.period || "monthly",
            linkedResultId: t.linkedResultId || null,
          },
        })
      ),
    ]);

    refreshed++;
    created += tiersToCreate.length;
  }

  console.log(
    `Checked ${users.length} account(s); refreshed ${refreshed} Rewards card(s), created ${created} tier(s) (claimed rewards preserved).`
  );
}

refreshRewardsForAllAccounts()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());