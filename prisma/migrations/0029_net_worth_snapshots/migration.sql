-- Migration 0029: NetWorthSnapshot — periodic actual net worth captures, compared
-- against the Projections engine's forecast to show projection accuracy over time.
CREATE TABLE "NetWorthSnapshot" (
    "id"          INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "takenAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAssets" REAL,
    "totalDebts"  REAL,
    "netWorth"    REAL     NOT NULL,
    "source"      TEXT     NOT NULL DEFAULT 'auto',
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
