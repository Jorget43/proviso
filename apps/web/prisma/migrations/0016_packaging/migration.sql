-- CreateTable
CREATE TABLE "PackagedItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "person" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "carPrice" REAL,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER
);
