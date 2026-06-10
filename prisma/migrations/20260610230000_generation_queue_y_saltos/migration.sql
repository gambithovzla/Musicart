-- Fase 2: cola de generación del catálogo + saltos de descubrimiento.

CREATE TABLE "GenerationQueue" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'curator',
    "reason" TEXT,
    "result" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationQueue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GenerationQueue_key_key" ON "GenerationQueue"("key");

ALTER TABLE "Dossier" ADD COLUMN "jumpsJson" TEXT NOT NULL DEFAULT '[]';
