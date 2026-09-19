-- CreateTable
CREATE TABLE "SocialContent" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'vertical_video',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "hook" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "scenesJson" TEXT NOT NULL DEFAULT '[]',
    "factsSnapshotJson" TEXT NOT NULL DEFAULT '{}',
    "verificationJson" TEXT NOT NULL DEFAULT '{}',
    "rightsStatus" TEXT NOT NULL DEFAULT 'clear',
    "audioUrl" TEXT,
    "videoUrl" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialContent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialContent_status_createdAt_idx" ON "SocialContent"("status", "createdAt");
CREATE INDEX "SocialContent_dossierId_createdAt_idx" ON "SocialContent"("dossierId", "createdAt");

ALTER TABLE "SocialContent" ADD CONSTRAINT "SocialContent_dossierId_fkey"
FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
