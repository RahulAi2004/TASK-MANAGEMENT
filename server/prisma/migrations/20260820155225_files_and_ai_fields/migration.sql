-- AlterTable
ALTER TABLE "AiRun" ADD COLUMN "inputImageUrl" TEXT;
ALTER TABLE "AiRun" ADD COLUMN "metadata" TEXT;
ALTER TABLE "AiRun" ADD COLUMN "similarityScore" REAL;

-- CreateTable
CREATE TABLE "TaskFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'attachment',
    "dataUrl" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "uploadedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskFile_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
