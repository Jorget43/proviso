-- CreateTable: per-member concessional cap utilisation history (Phase 2B carry-forward)
CREATE TABLE "SuperHistory" (
    "id"                   INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member"               TEXT     NOT NULL,
    "financialYearEnding"  INTEGER  NOT NULL,
    "concessionalCap"      REAL     NOT NULL,
    "concessionalUtilised" REAL     NOT NULL,
    "totalSuperBalance"    REAL     NOT NULL,
    "createdAt"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SuperHistory_member_financialYearEnding_key"
    ON "SuperHistory"("member", "financialYearEnding");

CREATE INDEX "SuperHistory_member_idx" ON "SuperHistory"("member");
