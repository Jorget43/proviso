-- Add ages to IncomeSettings
ALTER TABLE "IncomeSettings" ADD COLUMN "jorgeAge" INTEGER NOT NULL DEFAULT 34;
ALTER TABLE "IncomeSettings" ADD COLUMN "graceAge" INTEGER NOT NULL DEFAULT 32;

-- Add partner super fields to SuperSettings
ALTER TABLE "SuperSettings" ADD COLUMN "partnerEnabled" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SuperSettings" ADD COLUMN "partnerBalance" REAL NOT NULL DEFAULT 80000;
ALTER TABLE "SuperSettings" ADD COLUMN "partnerRetirementAge" INTEGER NOT NULL DEFAULT 67;
ALTER TABLE "SuperSettings" ADD COLUMN "partnerAdditionalContribs" REAL NOT NULL DEFAULT 0;
