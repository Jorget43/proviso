-- IncomeSettings: add generic person1/person2 columns alongside legacy jorge/grace ones
ALTER TABLE "IncomeSettings" ADD COLUMN "person1FTE"        REAL    NOT NULL DEFAULT 0;
ALTER TABLE "IncomeSettings" ADD COLUMN "person2FTE"        REAL    NOT NULL DEFAULT 0;
ALTER TABLE "IncomeSettings" ADD COLUMN "person1HasHELP"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "IncomeSettings" ADD COLUMN "person2HasHELP"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "IncomeSettings" ADD COLUMN "person1MonthlyNet" REAL    NOT NULL DEFAULT 0;
ALTER TABLE "IncomeSettings" ADD COLUMN "person2MonthlyNet" REAL    NOT NULL DEFAULT 0;
ALTER TABLE "IncomeSettings" ADD COLUMN "person1Age"        INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "IncomeSettings" ADD COLUMN "person2Age"        INTEGER NOT NULL DEFAULT 30;

-- Copy existing data into new columns
UPDATE "IncomeSettings" SET
  "person1FTE"        = "jorgeFTE",
  "person2FTE"        = "graceFTE",
  "person1HasHELP"    = "jorgeHasHELP",
  "person2HasHELP"    = "graceHasHELP",
  "person1MonthlyNet" = "jorgeMonthlyNet",
  "person2MonthlyNet" = "graceMonthlyNet",
  "person1Age"        = "jorgeAge",
  "person2Age"        = "graceAge";

-- ProjectionSettings: add generic growth columns
ALTER TABLE "ProjectionSettings" ADD COLUMN "person1Growth" REAL NOT NULL DEFAULT 3.5;
ALTER TABLE "ProjectionSettings" ADD COLUMN "person2Growth" REAL NOT NULL DEFAULT 3.0;

UPDATE "ProjectionSettings" SET
  "person1Growth" = "jorgeGrowth",
  "person2Growth" = "graceGrowth";
