-- CreateTable: auth users (Phase 4 RBAC)
CREATE TABLE "User" (
    "id"           INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name"         TEXT     NOT NULL,
    "username"     TEXT     NOT NULL,
    "passwordHash" TEXT     NOT NULL,
    "role"         TEXT     NOT NULL,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateTable: server-side sessions (opaque token in httpOnly cookie)
CREATE TABLE "Session" (
    "id"        INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId"    INTEGER  NOT NULL,
    "token"     TEXT     NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
