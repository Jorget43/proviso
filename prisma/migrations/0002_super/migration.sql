-- CreateTable
CREATE TABLE "SuperSettings" (
    "id"                      INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "currentBalance"          REAL    NOT NULL DEFAULT 164000,
    "currentAge"              INTEGER NOT NULL DEFAULT 34,
    "retirementAge"           INTEGER NOT NULL DEFAULT 67,
    "salaryExcSuper"          REAL    NOT NULL DEFAULT 135035,
    "sgRate"                  REAL    NOT NULL DEFAULT 0.12,
    "investmentReturn"        REAL    NOT NULL DEFAULT 0.06,
    "additionalContribs"      REAL    NOT NULL DEFAULT 0,
    "fundFeePercent"          REAL    NOT NULL DEFAULT 0.005,
    "inflationRate"           REAL    NOT NULL DEFAULT 0.04,
    "salaryGrowthRate"        REAL    NOT NULL DEFAULT 0.04,
    "desiredRetirementIncome" REAL    NOT NULL DEFAULT 80000
);
