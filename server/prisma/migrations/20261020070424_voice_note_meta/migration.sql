-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TaskVoiceNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "audioData" TEXT NOT NULL,
    "transcript" TEXT,
    "fileName" TEXT,
    "durationSeconds" INTEGER,
    "recordedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskVoiceNote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TaskVoiceNote_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TaskVoiceNote" ("audioData", "createdAt", "id", "sequenceNo", "taskId", "transcript") SELECT "audioData", "createdAt", "id", "sequenceNo", "taskId", "transcript" FROM "TaskVoiceNote";
DROP TABLE "TaskVoiceNote";
ALTER TABLE "new_TaskVoiceNote" RENAME TO "TaskVoiceNote";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
