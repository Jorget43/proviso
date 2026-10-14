-- AlterTable
ALTER TABLE "HouseholdSettings" ADD COLUMN "state" TEXT;
ALTER TABLE "HouseholdSettings" ADD COLUMN "regional" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProjectionSettings" ADD COLUMN "lifeStagesOn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProjectionSettings" ADD COLUMN "childLeavesHomeAge" INTEGER NOT NULL DEFAULT 18;

-- CreateTable
CREATE TABLE "Child" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "birthYear" INTEGER NOT NULL,
    "birthMonth" INTEGER
);
