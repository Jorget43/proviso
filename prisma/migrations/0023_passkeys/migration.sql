CREATE TABLE "Passkey" (
  "id"           INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "userId"       INTEGER NOT NULL,
  "credentialId" TEXT NOT NULL,
  "publicKey"    BLOB NOT NULL,
  "counter"      BIGINT NOT NULL DEFAULT 0,
  "deviceType"   TEXT NOT NULL DEFAULT 'platform',
  "backedUp"     BOOLEAN NOT NULL DEFAULT false,
  "transports"   TEXT NOT NULL DEFAULT '',
  "name"         TEXT NOT NULL DEFAULT 'Passkey',
  "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Passkey_credentialId_key" ON "Passkey"("credentialId");

CREATE TABLE "WebAuthnChallenge" (
  "id"        INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "challenge" TEXT NOT NULL,
  "userId"    INT,
  "expiresAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "WebAuthnChallenge_challenge_key" ON "WebAuthnChallenge"("challenge");
