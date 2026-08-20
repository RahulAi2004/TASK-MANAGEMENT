-- CreateTable
CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "taskType" TEXT NOT NULL,
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
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaskTemplate_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskTemplate_code_key" ON "TaskTemplate"("code");
