-- AlterTable: SLA alerts pushed from Printshop carry a key so a re-delivered alert lands once.
ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;
CREATE INDEX "Notification_dedupeKey_idx" ON "Notification"("dedupeKey");
