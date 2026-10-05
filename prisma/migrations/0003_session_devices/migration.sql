-- Sessions now store a SHA-256 of the token rather than the token itself, so
-- existing rows can't be matched any more: clear them (everyone signs in once).
DELETE FROM "Session";

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'web';
ALTER TABLE "Session" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "Session" ADD COLUMN "lastUsedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
