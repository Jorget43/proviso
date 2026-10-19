-- AlterTable
ALTER TABLE "ProjectionSettings" ADD COLUMN "showRange" BOOLEAN;
ALTER TABLE "ProjectionSettings" ADD COLUMN "growthPct" REAL NOT NULL DEFAULT 70;
ALTER TABLE "ProjectionSettings" ADD COLUMN "glidePath" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProjectionSettings" ADD COLUMN "glideTargetPct" REAL NOT NULL DEFAULT 50;
