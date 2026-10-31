-- CreateTable
CREATE TABLE "TaskOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "list" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskOption_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskOption_list_value_key" ON "TaskOption"("list", "value");

-- The options that were fixed in the code until now
INSERT INTO "TaskOption" ("id", "list", "value", "sortOrder") VALUES
  (lower(hex(randomblob(16))), 'workType', 'General', 1),
  (lower(hex(randomblob(16))), 'workType', 'Background Removal', 2),
  (lower(hex(randomblob(16))), 'workType', 'Mockup Creation', 3),
  (lower(hex(randomblob(16))), 'workType', 'Production Artwork', 4),
  (lower(hex(randomblob(16))), 'workType', 'Artwork Extraction', 5),
  (lower(hex(randomblob(16))), 'workType', 'QA Review', 6),
  (lower(hex(randomblob(16))), 'workType', 'Gangsheet Preparation', 7),
  (lower(hex(randomblob(16))), 'workType', 'Follow-up', 8),
  (lower(hex(randomblob(16))), 'workType', 'Bug Fix', 9),
  (lower(hex(randomblob(16))), 'workType', 'Hardware', 10),
  (lower(hex(randomblob(16))), 'workType', 'Access Request', 11),
  (lower(hex(randomblob(16))), 'category', 'Order Related', 1),
  (lower(hex(randomblob(16))), 'category', 'General', 2),
  (lower(hex(randomblob(16))), 'category', 'Admin', 3),
  (lower(hex(randomblob(16))), 'linkedTo', 'General', 1),
  (lower(hex(randomblob(16))), 'linkedTo', 'Artwork', 2),
  (lower(hex(randomblob(16))), 'linkedTo', 'Sales Order', 3),
  (lower(hex(randomblob(16))), 'linkedTo', 'Lead', 4),
  (lower(hex(randomblob(16))), 'linkedTo', 'System', 5),
  (lower(hex(randomblob(16))), 'delayReason', 'Waiting on customer', 1),
  (lower(hex(randomblob(16))), 'delayReason', 'Waiting on another department', 2),
  (lower(hex(randomblob(16))), 'delayReason', 'Missing information / files', 3),
  (lower(hex(randomblob(16))), 'delayReason', 'Rework requested', 4),
  (lower(hex(randomblob(16))), 'delayReason', 'Technical / system issue', 5),
  (lower(hex(randomblob(16))), 'delayReason', 'High workload', 6),
  (lower(hex(randomblob(16))), 'delayReason', 'Other', 7);
