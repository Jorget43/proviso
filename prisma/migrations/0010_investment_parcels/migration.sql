-- CreateTable: per-parcel investment holdings for CGT estimates (Phase 6)
CREATE TABLE "InvestmentParcel" (
    "id"            INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "member"        TEXT     NOT NULL,
    "name"          TEXT     NOT NULL,
    "quantity"      REAL     NOT NULL DEFAULT 0,
    "purchasePrice" REAL     NOT NULL DEFAULT 0,
    "purchaseDate"  TEXT     NOT NULL,
    "currentPrice"  REAL     NOT NULL DEFAULT 0,
    "sellYear"      INTEGER,
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
