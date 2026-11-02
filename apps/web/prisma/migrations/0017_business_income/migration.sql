-- CreateTable
CREATE TABLE "IncomeSource" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "person" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT,
    "amount" REAL NOT NULL,
    "growthPct" REAL NOT NULL DEFAULT 3,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER
);
