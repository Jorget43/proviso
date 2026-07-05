-- Drop deprecated jorge/grace columns and tables — superseded by person1/person2
-- equivalents added in 0024_rename_income_projection_cols and 0025_rename_phase_tables.
-- Data was copied over in those migrations; app code has been fully cut over since.

ALTER TABLE "IncomeSettings" DROP COLUMN "jorgeFTE";
ALTER TABLE "IncomeSettings" DROP COLUMN "graceFTE";
ALTER TABLE "IncomeSettings" DROP COLUMN "jorgeHasHELP";
ALTER TABLE "IncomeSettings" DROP COLUMN "graceHasHELP";
ALTER TABLE "IncomeSettings" DROP COLUMN "jorgeMonthlyNet";
ALTER TABLE "IncomeSettings" DROP COLUMN "graceMonthlyNet";
ALTER TABLE "IncomeSettings" DROP COLUMN "jorgeAge";
ALTER TABLE "IncomeSettings" DROP COLUMN "graceAge";

ALTER TABLE "ProjectionSettings" DROP COLUMN "jorgeGrowth";
ALTER TABLE "ProjectionSettings" DROP COLUMN "graceGrowth";

DROP TABLE "GracePhase";
DROP TABLE "JorgePhase";
