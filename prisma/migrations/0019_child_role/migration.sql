CREATE TABLE "AllowanceSchedule" (
  "id"        INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "userId"    INTEGER NOT NULL UNIQUE,
  "amount"    REAL    NOT NULL,
  "dayOfWeek" INTEGER NOT NULL DEFAULT 5,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AllowanceSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PocketMoneyTx" (
  "id"          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "userId"      INTEGER NOT NULL,
  "amount"      REAL    NOT NULL,
  "description" TEXT    NOT NULL,
  "date"        TEXT    NOT NULL,
  "category"    TEXT    NOT NULL DEFAULT 'general',
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PocketMoneyTx_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
