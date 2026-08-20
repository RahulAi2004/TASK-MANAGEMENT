-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "actionType" TEXT NOT NULL DEFAULT 'H',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "parentTaskId" TEXT,
    "departmentId" TEXT,
    "assignedUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewerId" TEXT,
    "requiresAcceptance" BOOLEAN NOT NULL DEFAULT false,
    "requiresReview" BOOLEAN NOT NULL DEFAULT true,
    "startAfter" DATETIME,
    "dueAt" DATETIME,
    "estimatedMinutes" INTEGER,
    "startedAt" DATETIME,
    "submittedAt" DATETIME,
    "completedAt" DATETIME,
    "completionSummary" TEXT,
    "performedByType" TEXT NOT NULL DEFAULT 'User',
    "affectedSystem" TEXT,
    "metadata" TEXT,
    "voiceNote" TEXT,
    "voiceTranscript" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("affectedSystem", "assignedUserId", "completedAt", "completionSummary", "createdAt", "createdById", "deletedAt", "departmentId", "description", "dueAt", "entityId", "entityType", "estimatedMinutes", "id", "metadata", "parentTaskId", "performedByType", "priority", "requiresAcceptance", "requiresReview", "reviewerId", "startAfter", "startedAt", "status", "submittedAt", "subtitle", "taskNo", "taskType", "title", "updatedAt", "voiceNote", "voiceTranscript") SELECT "affectedSystem", "assignedUserId", "completedAt", "completionSummary", "createdAt", "createdById", "deletedAt", "departmentId", "description", "dueAt", "entityId", "entityType", "estimatedMinutes", "id", "metadata", "parentTaskId", "performedByType", "priority", "requiresAcceptance", "requiresReview", "reviewerId", "startAfter", "startedAt", "status", "submittedAt", "subtitle", "taskNo", "taskType", "title", "updatedAt", "voiceNote", "voiceTranscript" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE UNIQUE INDEX "Task_taskNo_key" ON "Task"("taskNo");
CREATE TABLE "new_TaskTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "taskType" TEXT NOT NULL,
    "actionType" TEXT NOT NULL DEFAULT 'H',
    "entityType" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "departmentId" TEXT,
    "slaHours" INTEGER,
    "estimatedMinutes" INTEGER,
    "requiresReview" BOOLEAN NOT NULL DEFAULT true,
    "requiresAcceptance" BOOLEAN NOT NULL DEFAULT false,
    "aiFirstAttempt" BOOLEAN NOT NULL DEFAULT false,
    "checklistJson" TEXT,
    "triggerEvent" TEXT,
    "dependsOnTaskType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaskTemplate_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TaskTemplate" ("aiFirstAttempt", "checklistJson", "code", "createdAt", "createdById", "departmentId", "dependsOnTaskType", "description", "entityType", "estimatedMinutes", "id", "isActive", "name", "priority", "requiresAcceptance", "requiresReview", "slaHours", "taskType", "triggerEvent", "updatedAt", "usageCount") SELECT "aiFirstAttempt", "checklistJson", "code", "createdAt", "createdById", "departmentId", "dependsOnTaskType", "description", "entityType", "estimatedMinutes", "id", "isActive", "name", "priority", "requiresAcceptance", "requiresReview", "slaHours", "taskType", "triggerEvent", "updatedAt", "usageCount" FROM "TaskTemplate";
DROP TABLE "TaskTemplate";
ALTER TABLE "new_TaskTemplate" RENAME TO "TaskTemplate";
CREATE UNIQUE INDEX "TaskTemplate_code_key" ON "TaskTemplate"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
