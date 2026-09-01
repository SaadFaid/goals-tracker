-- CreateTable
CREATE TABLE "MonthlySnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySnapshot_userId_month_key" ON "MonthlySnapshot"("userId", "month");

-- CreateIndex
CREATE INDEX "MonthlySnapshot_userId_month_idx" ON "MonthlySnapshot"("userId", "month");

-- AddForeignKey
ALTER TABLE "MonthlySnapshot" ADD CONSTRAINT "MonthlySnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
