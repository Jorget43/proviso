-- Link cash accounts to the mortgage offset.
ALTER TABLE "Asset" ADD COLUMN "isOffset" BOOLEAN NOT NULL DEFAULT false;
