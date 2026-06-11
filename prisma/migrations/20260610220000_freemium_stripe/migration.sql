-- Fase 4.5: Stripe freemium + contador de dossiers/mes

ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN "subscriptionStatus" TEXT;
ALTER TABLE "User" ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

CREATE TABLE "DossierView" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "listenerKey" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "DossierView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DossierView_albumId_listenerKey_monthKey_key" ON "DossierView"("albumId", "listenerKey", "monthKey");
CREATE INDEX "DossierView_listenerKey_monthKey_idx" ON "DossierView"("listenerKey", "monthKey");

ALTER TABLE "DossierView" ADD CONSTRAINT "DossierView_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DossierView" ADD CONSTRAINT "DossierView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
