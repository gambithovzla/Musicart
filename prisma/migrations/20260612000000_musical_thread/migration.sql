-- CreateTable
CREATE TABLE "MusicalThread" (
    "id" TEXT NOT NULL,
    "listenerKey" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicalThread_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MusicalThread_listenerKey_key" ON "MusicalThread"("listenerKey");
