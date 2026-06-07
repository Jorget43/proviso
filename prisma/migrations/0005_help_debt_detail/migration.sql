-- CreateTable
CREATE TABLE "HelpDebtDetail" (
    "id"                  INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member"              TEXT     NOT NULL,
    "financialYearEnding" INTEGER  NOT NULL,
    "openingFyBalance"    REAL     NOT NULL DEFAULT 0,
    "estimatedWithheld"   REAL     NOT NULL DEFAULT 0,
    "voluntaryRepayments" REAL     NOT NULL DEFAULT 0,
    "cpiRate"             REAL     NOT NULL DEFAULT 3.5,
    "createdAt"           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "HelpDebtDetail_member_financialYearEnding_key"
    ON "HelpDebtDetail"("member", "financialYearEnding");
