-- Fase 8 — Caminos: secuencia ordenada de discos para entrar a un género.
-- Los pasos van en "stepsJson" (CaminoStep[]); ver src/lib/caminos.ts.
CREATE TABLE "Camino" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT,
    "tema" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "intro" TEXT,
    "stepsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Camino_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Camino_deviceId_status_idx" ON "Camino"("deviceId", "status");
CREATE INDEX "Camino_userId_status_idx" ON "Camino"("userId", "status");

ALTER TABLE "Camino" ADD CONSTRAINT "Camino_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
