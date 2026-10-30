-- CreateTable
CREATE TABLE "TaskGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#2563EB',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "groupId" TEXT,
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
    CONSTRAINT "Task_routineTaskId_fkey" FOREIGN KEY ("routineTaskId") REFERENCES "RoutineTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TaskGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("actionType", "affectedSystem", "assignedUserId", "completedAt", "completionSummary", "createdAt", "createdById", "deletedAt", "departmentId", "description", "dueAt", "entityId", "entityType", "estimatedMinutes", "id", "metadata", "parentTaskId", "performedByType", "priority", "requiresAcceptance", "requiresReview", "reviewerId", "routineTaskId", "slaCriticalMinutes", "slaDelayedMinutes", "startAfter", "startedAt", "status", "submittedAt", "subtitle", "taskNo", "taskType", "title", "updatedAt", "voiceNote", "voiceTranscript") SELECT "actionType", "affectedSystem", "assignedUserId", "completedAt", "completionSummary", "createdAt", "createdById", "deletedAt", "departmentId", "description", "dueAt", "entityId", "entityType", "estimatedMinutes", "id", "metadata", "parentTaskId", "performedByType", "priority", "requiresAcceptance", "requiresReview", "reviewerId", "routineTaskId", "slaCriticalMinutes", "slaDelayedMinutes", "startAfter", "startedAt", "status", "submittedAt", "subtitle", "taskNo", "taskType", "title", "updatedAt", "voiceNote", "voiceTranscript" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE UNIQUE INDEX "Task_taskNo_key" ON "Task"("taskNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TaskGroup_name_key" ON "TaskGroup"("name");

-- Starter groups. The timestamps keep them in this order; no tasks are moved into them.
INSERT INTO "TaskGroup" ("id", "name", "color", "createdAt") VALUES
  ('group-decoinks-operations', 'Decoinks Operations', '#2563EB', '2026-10-30 00:00:01'),
  ('group-crm-follow-ups', 'CRM Follow-ups', '#16A34A', '2026-10-30 00:00:02'),
  ('group-design-artwork', 'Design & Artwork', '#8B5CF6', '2026-10-30 00:00:03'),
  ('group-purchase-orders', 'Purchase Orders', '#F97316', '2026-10-30 00:00:04'),
  ('group-production-qa', 'Production & QA', '#06B6D4', '2026-10-30 00:00:05'),
  ('group-shipping-delivery', 'Shipping & Delivery', '#EAB308', '2026-10-30 00:00:06'),
  ('group-admin-tasks', 'Admin Tasks', '#EF4444', '2026-10-30 00:00:07'),
  ('group-personal-tasks', 'Personal Tasks', '#2563EB', '2026-10-30 00:00:08');
