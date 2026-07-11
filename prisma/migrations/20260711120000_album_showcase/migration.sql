-- La vitrina del curador: discos que el admin atesora y exhibe públicamente.
ALTER TABLE "Album" ADD COLUMN "showcase" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Album" ADD COLUMN "showcaseAt" TIMESTAMP(3);

CREATE INDEX "Album_showcase_showcaseAt_idx" ON "Album"("showcase", "showcaseAt");
