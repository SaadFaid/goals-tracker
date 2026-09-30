/**
 * Give every category a real sortOrder.
 *
 * Categories were created before sortOrder existed, so the column is still null
 * for the rows that predate it. Ordering by a column that is null for every row
 * is not ordering at all: Postgres returns them in whatever order the heap
 * happens to hold, which is stable until a vacuum, an index rebuild or a new
 * insert reshuffles it. The dashboard looked right and then quietly moved
 * categories around, which is exactly the "my placements changed" report.
 *
 * Idempotent, and it never renumbers a category that already has a value, so
 * running it cannot undo a deliberate drag-reorder. Only nulls are filled, using
 * the lowest free integer so an existing 0..n block is left untouched.
 */
import { prisma } from "../lib/prisma.js";

async function backfillCategories() {
  const cats = await prisma.category.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, userId: true, sortOrder: true, name: true },
  });

  const byUser = new Map();
  for (const c of cats) {
    if (!byUser.has(c.userId)) byUser.set(c.userId, []);
    byUser.get(c.userId).push(c);
  }

  let updated = 0;
  for (const [userId, list] of byUser) {
    const taken = new Set(list.filter((c) => c.sortOrder !== null).map((c) => c.sortOrder));
    let next = 0;
    const freeOrder = () => {
      while (taken.has(next)) next += 1;
      taken.add(next);
      return next;
    };

    // Keep the existing block intact: fill the gaps first, then append.
    for (const c of list.filter((x) => x.sortOrder === null)) {
      await prisma.category.update({
        where: { id: c.id },
        data: { sortOrder: freeOrder() },
      });
      updated += 1;
      console.log(`  + ${c.name} (${userId.slice(0, 8)}) -> sortOrder assigned`);
    }
  }

  console.log(`  categories backfilled: ${updated} of ${cats.length}`);
  return updated;
}

async function main() {
  const updated = await backfillCategories();
  if (updated === 0) console.log("  nothing to do - every category already has a sortOrder");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("  backfill failed:", err.message);
    await prisma.$disconnect();
    process.exit(1);
  });
