CREATE TABLE "RentSettings" (
  "id"                   INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
  "enabled"              BOOLEAN NOT NULL DEFAULT 0,
  "monthlyRent"          REAL    NOT NULL DEFAULT 0,
  "annualIncreaseRate"   REAL    NOT NULL DEFAULT 5.0,
  "purchasePlanEnabled"  BOOLEAN NOT NULL DEFAULT 0,
  "targetPurchaseYear"   INTEGER NOT NULL DEFAULT 2031,
  "targetPropertyValue"  REAL    NOT NULL DEFAULT 800000,
  "depositPct"           REAL    NOT NULL DEFAULT 20.0,
  "depositFromCash"      REAL    NOT NULL DEFAULT 0,
  "depositFromInvestments" REAL  NOT NULL DEFAULT 0,
  "newMortgageRate"      REAL    NOT NULL DEFAULT 6.0,
  "newMortgageTermYrs"   INTEGER NOT NULL DEFAULT 30
);
