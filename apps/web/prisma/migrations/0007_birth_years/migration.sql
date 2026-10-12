-- AlterTable
ALTER TABLE "IncomeSettings" ADD COLUMN "person1BirthYear" INTEGER;
ALTER TABLE "IncomeSettings" ADD COLUMN "person2BirthYear" INTEGER;

-- Birth years from the ages already saved, so ages move on from here.
-- (strftime's "now" is UTC: on New Year's morning in Australia it still
-- reads the old year, which puts the birth year one earlier. Harmless.)
UPDATE "IncomeSettings" SET "person1BirthYear" = CAST(strftime('%Y', 'now') AS INTEGER) - "person1Age" WHERE "person1BirthYear" IS NULL;
UPDATE "IncomeSettings" SET "person2BirthYear" = CAST(strftime('%Y', 'now') AS INTEGER) - "person2Age" WHERE "person2BirthYear" IS NULL;
