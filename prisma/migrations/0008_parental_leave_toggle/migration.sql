-- Add parental leave toggle to ProjectionSettings
-- Defaults to true so existing DBs keep current behaviour
ALTER TABLE "ProjectionSettings" ADD COLUMN "parentalLeaveEnabled" BOOLEAN NOT NULL DEFAULT true;
