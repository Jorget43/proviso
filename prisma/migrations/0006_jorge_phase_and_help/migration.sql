-- Add jorgeHasHELP to IncomeSettings
ALTER TABLE "IncomeSettings" ADD COLUMN "jorgeHasHELP" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable JorgePhase
CREATE TABLE "JorgePhase" (
    "id"   INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "year" INTEGER NOT NULL,
    "days" INTEGER NOT NULL
);
