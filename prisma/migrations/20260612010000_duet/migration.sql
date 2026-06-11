-- CreateTable
CREATE TABLE "DuetPair" (
    "id" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "DuetPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuetPick" (
    "id" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuetPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DuetPair_inviteCode_key" ON "DuetPair"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "DuetPick_pairId_weekKey_key" ON "DuetPick"("pairId", "weekKey");

-- AddForeignKey
ALTER TABLE "DuetPair" ADD CONSTRAINT "DuetPair_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuetPair" ADD CONSTRAINT "DuetPair_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuetPick" ADD CONSTRAINT "DuetPick_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "DuetPair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuetPick" ADD CONSTRAINT "DuetPick_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
