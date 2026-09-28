-- The client stores weight/invert/isBadge on actions and results, and price on
-- rewards, but the tables had no columns for them. Importing a local profile
-- therefore dropped them: result weights read back as 0, which feeds
-- calculateDashboardState a wrong denominator (src/lib/calc.js), and isBadge /
-- price silently changed how the category card renders.

-- AlterTable
ALTER TABLE "Action" ADD COLUMN "invert" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "weight"  INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "invert"  BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isBadge" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Reward" ADD COLUMN "price" DOUBLE PRECISION;
