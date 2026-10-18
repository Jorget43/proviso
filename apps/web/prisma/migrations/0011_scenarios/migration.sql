-- CreateTable
CREATE TABLE "Scenario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "colour" TEXT NOT NULL DEFAULT 'blue',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "overrides" TEXT NOT NULL DEFAULT '{}'
);
