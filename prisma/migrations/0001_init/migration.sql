-- CreateTable
CREATE TABLE "Expense" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cat" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "freq" TEXT NOT NULL,
    "amt" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "amt" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "amt" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "MortgageSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "balance" REAL NOT NULL DEFAULT 530073,
    "rate" REAL NOT NULL DEFAULT 5.99,
    "payment" REAL NOT NULL DEFAULT 3237,
    "offsetBal" REAL NOT NULL DEFAULT 47563,
    "endDate" TEXT NOT NULL DEFAULT '2053-01-16'
);

-- CreateTable
CREATE TABLE "IncomeSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "jorgeFTE" REAL NOT NULL DEFAULT 150000,
    "graceFTE" REAL NOT NULL DEFAULT 100000,
    "graceHasHELP" BOOLEAN NOT NULL DEFAULT true,
    "taxMode" BOOLEAN NOT NULL DEFAULT true,
    "jorgeMonthlyNet" REAL NOT NULL DEFAULT 9176,
    "graceMonthlyNet" REAL NOT NULL DEFAULT 4436
);

-- CreateTable
CREATE TABLE "GracePhase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "year" INTEGER NOT NULL,
    "days" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectionSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "jorgeGrowth" REAL NOT NULL DEFAULT 3.5,
    "graceGrowth" REAL NOT NULL DEFAULT 3.0,
    "expInflNear" REAL NOT NULL DEFAULT 4.0,
    "expInfl" REAL NOT NULL DEFAULT 2.5,
    "childcareInfl" REAL NOT NULL DEFAULT 6.0,
    "propGrowth" REAL NOT NULL DEFAULT 3.5,
    "savingsRate" REAL NOT NULL DEFAULT 10.0,
    "investReturn" REAL NOT NULL DEFAULT 3.5,
    "projYears" INTEGER NOT NULL DEFAULT 20,
    "schoolFeesOn" BOOLEAN NOT NULL DEFAULT false,
    "sfC1Start" INTEGER NOT NULL DEFAULT 2028,
    "sfC1ExitIdx" INTEGER NOT NULL DEFAULT 13,
    "sfC2Start" INTEGER NOT NULL DEFAULT 2031,
    "sfC2ExitIdx" INTEGER NOT NULL DEFAULT 13,
    "sfInfl" REAL NOT NULL DEFAULT 5.0
);

-- CreateTable
CREATE TABLE "LifePhase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "monthlyAmt" REAL NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER NOT NULL,
    "cat" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "OneOff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "amt" REAL NOT NULL,
    "year" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dateStr" TEXT NOT NULL,
    "ym" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "amt" REAL NOT NULL,
    "cat" TEXT NOT NULL,
    "originalCat" TEXT NOT NULL,
    "catSource" TEXT NOT NULL,
    "lumpy" BOOLEAN NOT NULL DEFAULT false,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CategoriationRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pattern" TEXT NOT NULL,
    "cat" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'user',
    "hits" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "SuggestionState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cat" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "ActualsSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "useActualsProjections" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_dateStr_desc_amt_key" ON "Transaction"("dateStr", "desc", "amt");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriationRule_pattern_key" ON "CategoriationRule"("pattern");

-- CreateIndex
CREATE UNIQUE INDEX "SuggestionState_cat_key" ON "SuggestionState"("cat");
