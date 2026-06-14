ALTER TABLE "User" ADD COLUMN "email" TEXT;

CREATE TABLE "PasswordReset" (
    "id"        INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId"    INTEGER NOT NULL,
    "token"     TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt"    DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PasswordReset_token_key" ON "PasswordReset"("token");
