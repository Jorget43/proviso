CREATE TABLE "WorkExpense" (
  "id"          INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
  "description" TEXT     NOT NULL,
  "amount"      REAL     NOT NULL,
  "date"        TEXT     NOT NULL,
  "category"    TEXT     NOT NULL DEFAULT 'Other',
  "financialYr" INTEGER  NOT NULL,
  "source"      TEXT     NOT NULL DEFAULT 'manual',
  "txnId"       INTEGER,
  "receiptRef"  TEXT     NOT NULL DEFAULT '',
  "notes"       TEXT     NOT NULL DEFAULT '',
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
