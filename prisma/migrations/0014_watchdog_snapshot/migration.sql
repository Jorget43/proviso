-- Migration 0014: WatchdogSnapshot — stores weekly watchdog reports for diff/notification
CREATE TABLE "WatchdogSnapshot" (
    "id"          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "takenAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportJson"  TEXT NOT NULL,
    "emailSentAt" DATETIME
);
