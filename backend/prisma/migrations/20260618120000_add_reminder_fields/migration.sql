-- AlterTable
ALTER TABLE "ReturnedReceipt"
ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastReminderAt" TIMESTAMP(3);
