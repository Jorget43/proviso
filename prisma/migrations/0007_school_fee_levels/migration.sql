-- CreateTable SchoolFeeLevel
CREATE TABLE "SchoolFeeLevel" (
    "id"      INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level"   TEXT    NOT NULL,
    "tuition" REAL    NOT NULL DEFAULT 0,
    "fixed"   REAL    NOT NULL DEFAULT 0
);

-- CreateIndex unique level
CREATE UNIQUE INDEX "SchoolFeeLevel_level_key" ON "SchoolFeeLevel"("level");
