-- Childcare subsidy (CCS) inputs.
CREATE TABLE "ChildcareSettings" (
    "id"          INTEGER NOT NULL PRIMARY KEY,
    "enabled"     BOOLEAN NOT NULL DEFAULT false,
    "costPerDay"  REAL    NOT NULL DEFAULT 130,
    "daysPerWeek" INTEGER NOT NULL DEFAULT 3,
    "numChildren" INTEGER NOT NULL DEFAULT 1
);
INSERT INTO "ChildcareSettings" ("id", "enabled", "costPerDay", "daysPerWeek", "numChildren")
VALUES (1, false, 130, 3, 1);
