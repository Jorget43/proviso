CREATE TABLE "Donation" (
  "id"          INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
  "charity"     TEXT     NOT NULL,
  "abn"         TEXT     NOT NULL DEFAULT '',
  "amount"      REAL     NOT NULL,
  "date"        TEXT     NOT NULL,
  "financialYr" INTEGER  NOT NULL,
  "source"      TEXT     NOT NULL DEFAULT 'manual',
  "txnId"       INTEGER,
  "notes"       TEXT     NOT NULL DEFAULT '',
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
