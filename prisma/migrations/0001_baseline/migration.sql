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
CREATE TABLE "AnnualExpense" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "cat" TEXT NOT NULL,
    "amt" REAL NOT NULL,
    "month" INTEGER NOT NULL,
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
    "amt" REAL NOT NULL,
    "isOffset" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "MortgageSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "balance" REAL NOT NULL DEFAULT 0,
    "rate" REAL NOT NULL DEFAULT 6.0,
    "payment" REAL NOT NULL DEFAULT 0,
    "offsetBal" REAL NOT NULL DEFAULT 0,
    "endDate" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "ChildcareSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "costPerDay" REAL NOT NULL DEFAULT 130,
    "daysPerWeek" INTEGER NOT NULL DEFAULT 3,
    "numChildren" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "IncomeSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "taxMode" BOOLEAN NOT NULL DEFAULT true,
    "person1FTE" REAL NOT NULL DEFAULT 0,
    "person2FTE" REAL NOT NULL DEFAULT 0,
    "person1HasHELP" BOOLEAN NOT NULL DEFAULT false,
    "person2HasHELP" BOOLEAN NOT NULL DEFAULT false,
    "person1MonthlyNet" REAL NOT NULL DEFAULT 0,
    "person2MonthlyNet" REAL NOT NULL DEFAULT 0,
    "person1Age" INTEGER NOT NULL DEFAULT 30,
    "person2Age" INTEGER NOT NULL DEFAULT 30
);

-- CreateTable
CREATE TABLE "Person1Phase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "year" INTEGER NOT NULL,
    "days" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Person2Phase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "year" INTEGER NOT NULL,
    "days" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectionSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "person1Growth" REAL NOT NULL DEFAULT 3.5,
    "person2Growth" REAL NOT NULL DEFAULT 3.0,
    "expInflNear" REAL NOT NULL DEFAULT 4.0,
    "expInfl" REAL NOT NULL DEFAULT 2.5,
    "childcareInfl" REAL NOT NULL DEFAULT 6.0,
    "propGrowth" REAL NOT NULL DEFAULT 3.5,
    "savingsRate" REAL NOT NULL DEFAULT 10.0,
    "investReturn" REAL NOT NULL DEFAULT 3.5,
    "projYears" INTEGER NOT NULL DEFAULT 20,
    "schoolFeesOn" BOOLEAN NOT NULL DEFAULT false,
    "sfC1Start" INTEGER NOT NULL DEFAULT 2032,
    "sfC1ExitIdx" INTEGER NOT NULL DEFAULT 13,
    "sfC2Start" INTEGER NOT NULL DEFAULT 2035,
    "sfC2ExitIdx" INTEGER NOT NULL DEFAULT 13,
    "sfInfl" REAL NOT NULL DEFAULT 5.0,
    "sfPresetKey" TEXT,
    "parentalLeaveEnabled" BOOLEAN NOT NULL DEFAULT true
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

-- CreateTable
CREATE TABLE "HouseholdSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "person1Name" TEXT NOT NULL DEFAULT 'You',
    "person2Name" TEXT NOT NULL DEFAULT 'Partner',
    "partnerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "SchoolFeeLevel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level" TEXT NOT NULL,
    "tuition" REAL NOT NULL DEFAULT 0,
    "fixed" REAL NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "HelpDebtDetail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member" TEXT NOT NULL,
    "financialYearEnding" INTEGER NOT NULL,
    "openingFyBalance" REAL NOT NULL DEFAULT 0,
    "estimatedWithheld" REAL NOT NULL DEFAULT 0,
    "voluntaryRepayments" REAL NOT NULL DEFAULT 0,
    "cpiRate" REAL NOT NULL DEFAULT 3.5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SuperSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "currentBalance" REAL NOT NULL DEFAULT 0,
    "retirementAge" INTEGER NOT NULL DEFAULT 67,
    "additionalContribs" REAL NOT NULL DEFAULT 0,
    "sgRate" REAL NOT NULL DEFAULT 0.12,
    "investmentReturn" REAL NOT NULL DEFAULT 0.06,
    "fundFeePercent" REAL NOT NULL DEFAULT 0.005,
    "inflationRate" REAL NOT NULL DEFAULT 0.04,
    "desiredRetirementIncome" REAL NOT NULL DEFAULT 60000,
    "partnerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "partnerBalance" REAL NOT NULL DEFAULT 0,
    "partnerRetirementAge" INTEGER NOT NULL DEFAULT 67,
    "partnerAdditionalContribs" REAL NOT NULL DEFAULT 0,
    "currentAge" INTEGER NOT NULL DEFAULT 30,
    "salaryExcSuper" REAL NOT NULL DEFAULT 0,
    "salaryGrowthRate" REAL NOT NULL DEFAULT 0.04
);

-- CreateTable
CREATE TABLE "SuperHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member" TEXT NOT NULL,
    "financialYearEnding" INTEGER NOT NULL,
    "concessionalCap" REAL NOT NULL,
    "concessionalUtilised" REAL NOT NULL,
    "totalSuperBalance" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InvestmentParcel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "purchasePrice" REAL NOT NULL DEFAULT 0,
    "purchaseDate" TEXT NOT NULL,
    "currentPrice" REAL NOT NULL DEFAULT 0,
    "sellYear" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "totpSecret" TEXT,
    "totpRecoveryCodes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AllowanceSchedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "dayOfWeek" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AllowanceSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PocketMoneyTx" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PocketMoneyTx_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchdogSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "takenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportJson" TEXT NOT NULL,
    "emailSentAt" DATETIME
);

-- CreateTable
CREATE TABLE "VersionCheck" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latestTag" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Passkey" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BLOB NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "deviceType" TEXT NOT NULL DEFAULT 'platform',
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "transports" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT 'Passkey',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebAuthnChallenge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "challenge" TEXT NOT NULL,
    "userId" INTEGER,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NetWorthSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "takenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAssets" REAL,
    "totalDebts" REAL,
    "netWorth" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "charity" TEXT NOT NULL,
    "abn" TEXT NOT NULL DEFAULT '',
    "amount" REAL NOT NULL,
    "date" TEXT NOT NULL,
    "financialYr" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "txnId" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkExpense" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "description" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "date" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "financialYr" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "txnId" INTEGER,
    "receiptRef" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RentSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "monthlyRent" REAL NOT NULL DEFAULT 0,
    "annualIncreaseRate" REAL NOT NULL DEFAULT 5.0,
    "purchasePlanEnabled" BOOLEAN NOT NULL DEFAULT false,
    "targetPurchaseYear" INTEGER NOT NULL DEFAULT 2031,
    "targetPropertyValue" REAL NOT NULL DEFAULT 800000,
    "depositPct" REAL NOT NULL DEFAULT 20.0,
    "depositFromCash" REAL NOT NULL DEFAULT 0,
    "depositFromInvestments" REAL NOT NULL DEFAULT 0,
    "newMortgageRate" REAL NOT NULL DEFAULT 6.0,
    "newMortgageTermYrs" INTEGER NOT NULL DEFAULT 30
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_dateStr_desc_amt_key" ON "Transaction"("dateStr", "desc", "amt");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriationRule_pattern_key" ON "CategoriationRule"("pattern");

-- CreateIndex
CREATE UNIQUE INDEX "SuggestionState_cat_key" ON "SuggestionState"("cat");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolFeeLevel_level_key" ON "SchoolFeeLevel"("level");

-- CreateIndex
CREATE UNIQUE INDEX "HelpDebtDetail_member_financialYearEnding_key" ON "HelpDebtDetail"("member", "financialYearEnding");

-- CreateIndex
CREATE INDEX "SuperHistory_member_idx" ON "SuperHistory"("member");

-- CreateIndex
CREATE UNIQUE INDEX "SuperHistory_member_financialYearEnding_key" ON "SuperHistory"("member", "financialYearEnding");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AllowanceSchedule_userId_key" ON "AllowanceSchedule"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_token_key" ON "PasswordReset"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Passkey_credentialId_key" ON "Passkey"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "WebAuthnChallenge_challenge_key" ON "WebAuthnChallenge"("challenge");

