-- Create generic phase tables alongside legacy JorgePhase / GracePhase
CREATE TABLE "Person1Phase" (
  "id"   INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "year" INTEGER NOT NULL,
  "days" INTEGER NOT NULL
);

CREATE TABLE "Person2Phase" (
  "id"   INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "year" INTEGER NOT NULL,
  "days" INTEGER NOT NULL
);

-- Copy existing phase data
INSERT INTO "Person1Phase" ("id", "year", "days") SELECT "id", "year", "days" FROM "JorgePhase";
INSERT INTO "Person2Phase" ("id", "year", "days") SELECT "id", "year", "days" FROM "GracePhase";
