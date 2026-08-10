-- Fase 9 — El Salón de la Fama: índice del canon con puntaje comparable.
-- El número no lo escribe un LLM: sale de señales duras y se calibra por
-- percentil contra todo el índice. Ver src/lib/canon/score.ts.
CREATE TABLE "CanonAlbum" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "year" INTEGER,
    "coverUrl" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "raw" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "signalsJson" TEXT NOT NULL DEFAULT '{}',
    "evidenceJson" TEXT NOT NULL DEFAULT '[]',
    "genresJson" TEXT NOT NULL DEFAULT '[]',
    "country" TEXT,
    "decade" INTEGER,
    "mbid" TEXT,
    "wikidataId" TEXT,
    "albumId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonAlbum_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CanonAlbum_key_key" ON "CanonAlbum"("key");
CREATE UNIQUE INDEX "CanonAlbum_mbid_key" ON "CanonAlbum"("mbid");
CREATE UNIQUE INDEX "CanonAlbum_wikidataId_key" ON "CanonAlbum"("wikidataId");
CREATE UNIQUE INDEX "CanonAlbum_albumId_key" ON "CanonAlbum"("albumId");
CREATE INDEX "CanonAlbum_score_idx" ON "CanonAlbum"("score");
CREATE INDEX "CanonAlbum_decade_score_idx" ON "CanonAlbum"("decade", "score");
CREATE INDEX "CanonAlbum_country_score_idx" ON "CanonAlbum"("country", "score");
