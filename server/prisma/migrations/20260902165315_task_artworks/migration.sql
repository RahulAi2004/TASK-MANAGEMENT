-- CreateTable
CREATE TABLE "TaskArtwork" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "artworkCode" TEXT,
    "customerName" TEXT,
    "folder" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "thumbData" TEXT,
    "sourceApp" TEXT NOT NULL DEFAULT 'design-studio',
    "addedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskArtwork_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskArtwork_taskId_assetId_key" ON "TaskArtwork"("taskId", "assetId");
