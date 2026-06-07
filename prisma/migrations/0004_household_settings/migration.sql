-- CreateTable
CREATE TABLE "HouseholdSettings" (
    "id"             INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "person1Name"    TEXT    NOT NULL DEFAULT 'You',
    "person2Name"    TEXT    NOT NULL DEFAULT 'Partner',
    "partnerEnabled" INTEGER NOT NULL DEFAULT 0,
    "onboardingDone" INTEGER NOT NULL DEFAULT 0
);
