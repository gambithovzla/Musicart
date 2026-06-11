-- Fase 5.1 + 5.2: Web Push y rebobinada mensual

CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "deviceId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Rewind" (
    "id" TEXT NOT NULL,
    "listenerKey" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "statsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rewind_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Rewind_listenerKey_monthKey_key" ON "Rewind"("listenerKey", "monthKey");
