-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "mbid" TEXT,
    "name" TEXT NOT NULL,
    "bio" TEXT,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "mbid" TEXT,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "coverUrl" TEXT,
    "durationMin" INTEGER,
    "difficulty" INTEGER NOT NULL DEFAULT 2,
    "impact" INTEGER NOT NULL DEFAULT 3,
    "linksJson" TEXT NOT NULL DEFAULT '{}',
    "paletteJson" TEXT,
    "factsJson" TEXT NOT NULL DEFAULT '{}',
    "artistId" TEXT NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dossier" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "intro" TEXT NOT NULL,
    "artistStory" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "questionsJson" TEXT NOT NULL DEFAULT '[]',
    "audioJson" TEXT,

    CONSTRAINT "Dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackNote" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "durationSec" INTEGER,

    CONSTRAINT "TrackNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "answersJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyPick" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "DailyPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "answersJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Artist_mbid_key" ON "Artist"("mbid");

-- CreateIndex
CREATE UNIQUE INDEX "Album_mbid_key" ON "Album"("mbid");

-- CreateIndex
CREATE UNIQUE INDEX "Dossier_albumId_locale_key" ON "Dossier"("albumId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "TrackNote_dossierId_position_key" ON "TrackNote"("dossierId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_deviceId_key" ON "Profile"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPick_deviceId_date_key" ON "DailyPick"("deviceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Review_deviceId_albumId_key" ON "Review"("deviceId", "albumId");

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackNote" ADD CONSTRAINT "TrackNote_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPick" ADD CONSTRAINT "DailyPick_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

