-- AlterTable
ALTER TABLE "DailyPick" ADD COLUMN "returnPick" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DailyPick" ADD COLUMN "absenceDays" INTEGER;
