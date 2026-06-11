-- Fase 5.3: preguntas al dossier (con límites anti-abuso)

CREATE TABLE "DossierChat" (
    "id" TEXT NOT NULL,
    "listenerKey" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DossierChat_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DossierChat_listenerKey_dateKey_idx" ON "DossierChat"("listenerKey", "dateKey");
CREATE INDEX "DossierChat_listenerKey_albumId_dateKey_idx" ON "DossierChat"("listenerKey", "albumId", "dateKey");
