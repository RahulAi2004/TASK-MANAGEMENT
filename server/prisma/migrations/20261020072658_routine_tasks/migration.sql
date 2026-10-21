-- CreateTable
CREATE TABLE "RoutineTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "normalMinutes" INTEGER NOT NULL,
    "criticalMinutes" INTEGER NOT NULL,
    "delayedMinutes" INTEGER NOT NULL,
    "templateId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoutineTask_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoutineTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TaskTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RoutineTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
    "routineTaskId" TEXT,
    "slaCriticalMinutes" INTEGER,
    "slaDelayedMinutes" INTEGER,
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
    CONSTRAINT "Task_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_routineTaskId_fkey" FOREIGN KEY ("routineTaskId") REFERENCES "RoutineTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("actionType", "affectedSystem", "assignedUserId", "completedAt", "completionSummary", "createdAt", "createdById", "deletedAt", "departmentId", "description", "dueAt", "entityId", "entityType", "estimatedMinutes", "id", "metadata", "parentTaskId", "performedByType", "priority", "requiresAcceptance", "requiresReview", "reviewerId", "startAfter", "startedAt", "status", "submittedAt", "subtitle", "taskNo", "taskType", "title", "updatedAt", "voiceNote", "voiceTranscript") SELECT "actionType", "affectedSystem", "assignedUserId", "completedAt", "completionSummary", "createdAt", "createdById", "deletedAt", "departmentId", "description", "dueAt", "entityId", "entityType", "estimatedMinutes", "id", "metadata", "parentTaskId", "performedByType", "priority", "requiresAcceptance", "requiresReview", "reviewerId", "startAfter", "startedAt", "status", "submittedAt", "subtitle", "taskNo", "taskType", "title", "updatedAt", "voiceNote", "voiceTranscript" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE UNIQUE INDEX "Task_taskNo_key" ON "Task"("taskNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "RoutineTask_departmentId_title_key" ON "RoutineTask"("departmentId", "title");
