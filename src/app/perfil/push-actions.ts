"use server";

// Fase 5.1: alta y baja de suscripciones Web Push del oyente.

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function savePushSubscription(
  sub: PushSubscriptionInput,
  deviceId: string,
) {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    throw new Error("Suscripción inválida");
  }
  const session = await auth();
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      deviceId: deviceId || null,
      userId: session?.user?.id ?? null,
    },
    update: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      deviceId: deviceId || null,
      userId: session?.user?.id ?? null,
    },
  });
}

export async function deletePushSubscription(endpoint: string) {
  if (!endpoint) return;
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}
