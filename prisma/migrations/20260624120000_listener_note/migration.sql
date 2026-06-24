-- Memoria personal del oyente: notas que le cuenta al curador sobre lo que escucha.
CREATE TABLE "ListenerNote" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "userId" TEXT,
    "albumId" TEXT,
    "albumTitle" TEXT,
    "albumArtist" TEXT,
    "text" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListenerNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ListenerNote_userId_createdAt_idx" ON "ListenerNote"("userId", "createdAt");
CREATE INDEX "ListenerNote_deviceId_createdAt_idx" ON "ListenerNote"("deviceId", "createdAt");
