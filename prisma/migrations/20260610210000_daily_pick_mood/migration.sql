-- Fase 1: el check-in de ánimo personaliza el pick del día.
ALTER TABLE "DailyPick" ADD COLUMN "mood" TEXT;
ALTER TABLE "DailyPick" ADD COLUMN "regenerated" BOOLEAN NOT NULL DEFAULT false;
