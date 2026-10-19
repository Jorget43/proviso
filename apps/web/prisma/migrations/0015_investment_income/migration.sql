-- AlterTable
ALTER TABLE "ProjectionSettings" ADD COLUMN "dividendYield" REAL NOT NULL DEFAULT 3;
ALTER TABLE "ProjectionSettings" ADD COLUMN "frankedPct" REAL NOT NULL DEFAULT 50;
ALTER TABLE "ProjectionSettings" ADD COLUMN "cashRate" REAL NOT NULL DEFAULT 4;
ALTER TABLE "ProjectionSettings" ADD COLUMN "person1InvestShare" REAL NOT NULL DEFAULT 50;
