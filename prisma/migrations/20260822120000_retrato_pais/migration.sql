-- Fase 11 — El Atlas: el retrato musical de un país ("Conociendo a…").
-- Un retrato es global (uno por país, no uno por oyente): ver src/lib/atlas.ts.
CREATE TABLE "RetratoPais" (
    "code" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "intro" TEXT,
    "discosJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'listo',
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetratoPais_pkey" PRIMARY KEY ("code")
);

CREATE INDEX "RetratoPais_status_idx" ON "RetratoPais"("status");
