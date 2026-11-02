-- AlterTable
ALTER TABLE "OneOff" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'cost';

-- AlterTable
ALTER TABLE "Person1Phase" ADD COLUMN "month" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Person2Phase" ADD COLUMN "month" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ProjectionSettings" ADD COLUMN "superGrowthPct" REAL;

-- The starter "extra costs by year" rows for children and a bigger family
-- are counted by life stages and the childcare line now, so turned on they'd
-- count the same costs twice. Removed by their starter names; anything the
-- household added or renamed stays.
DELETE FROM "LifePhase" WHERE "name" IN (
  'Child 1 — newborn consumables',
  'Daycare — Child 1',
  'Child 2 — newborn consumables',
  'Daycare — Child 2',
  'Grocery uplift — family of 4',
  'Utilities uplift — larger household',
  'Kids clothing & activities',
  'Holiday uplift — family of 4'
);
