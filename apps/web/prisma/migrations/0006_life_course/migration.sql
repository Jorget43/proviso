-- AlterTable
ALTER TABLE "ProjectionSettings" ADD COLUMN "horizonAge" INTEGER NOT NULL DEFAULT 95;

-- AlterTable
ALTER TABLE "SuperSettings" ADD COLUMN "drawdownStrategy" TEXT NOT NULL DEFAULT 'need';
ALTER TABLE "SuperSettings" ADD COLUMN "drawdownPct" REAL NOT NULL DEFAULT 5;
