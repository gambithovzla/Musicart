// Fase 4.5 — límite de dossiers/mes en plan gratis; ilimitado con suscripción Pro.

import { prisma } from "./db";
import { todayKey } from "./daily";
import { isAdminEmail } from "./admin";
import type { ListenerIdentity } from "./identity";

const DEFAULT_LIMIT = 5;

export function freemiumLimit(): number {
  const n = Number(process.env.FREEMIUM_DOSSIER_LIMIT ?? DEFAULT_LIMIT);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LIMIT;
}

export function listenerKey(identity: ListenerIdentity): string | null {
  if (identity.userId) return `u:${identity.userId}`;
  if (identity.deviceId) return `d:${identity.deviceId}`;
  return null;
}

export function monthKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function isProUser(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionStatus: true, subscriptionEndsAt: true, email: true },
  });
  if (!user) return false;
  if (isAdminEmail(user.email)) return true;
  if (user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing") {
    return true;
  }
  if (
    user.subscriptionStatus === "canceled" &&
    user.subscriptionEndsAt &&
    user.subscriptionEndsAt > new Date()
  ) {
    return true;
  }
  return false;
}

async function isTodaysPickAlbum(
  identity: ListenerIdentity,
  albumId: string,
): Promise<boolean> {
  const date = todayKey();
  if (identity.userId) {
    const byUser = await prisma.dailyPick.findFirst({
      where: { userId: identity.userId, date, albumId },
    });
    if (byUser) return true;
  }
  if (identity.deviceId) {
    const byDevice = await prisma.dailyPick.findUnique({
      where: { deviceId_date: { deviceId: identity.deviceId, date } },
    });
    if (byDevice?.albumId === albumId) return true;
  }
  return false;
}

export async function countDossiersThisMonth(key: string): Promise<number> {
  const mk = monthKey();
  return prisma.dossierView.count({
    where: { listenerKey: key, monthKey: mk },
  });
}

export async function hasViewedAlbumThisMonth(
  key: string,
  albumId: string,
): Promise<boolean> {
  const view = await prisma.dossierView.findUnique({
    where: {
      albumId_listenerKey_monthKey: {
        albumId,
        listenerKey: key,
        monthKey: monthKey(),
      },
    },
  });
  return Boolean(view);
}

export type DossierAccess = {
  allowed: boolean;
  isPro: boolean;
  isTodaysPick: boolean;
  used: number;
  limit: number;
  reason?: "limit" | "no_listener";
};

export async function checkDossierAccess(
  identity: ListenerIdentity,
  albumId: string,
  email?: string | null,
): Promise<DossierAccess> {
  const limit = freemiumLimit();
  const key = listenerKey(identity);

  if (isAdminEmail(email)) {
    return { allowed: true, isPro: true, isTodaysPick: false, used: 0, limit };
  }

  if (identity.userId && (await isProUser(identity.userId))) {
    return { allowed: true, isPro: true, isTodaysPick: false, used: 0, limit };
  }

  const todaysPick = await isTodaysPickAlbum(identity, albumId);
  if (todaysPick) {
    return { allowed: true, isPro: false, isTodaysPick: true, used: 0, limit };
  }

  if (!key) {
    return {
      allowed: false,
      isPro: false,
      isTodaysPick: false,
      used: 0,
      limit,
      reason: "no_listener",
    };
  }

  const alreadyViewed = await hasViewedAlbumThisMonth(key, albumId);
  if (alreadyViewed) {
    const used = await countDossiersThisMonth(key);
    return { allowed: true, isPro: false, isTodaysPick: false, used, limit };
  }

  const used = await countDossiersThisMonth(key);
  if (used >= limit) {
    return {
      allowed: false,
      isPro: false,
      isTodaysPick: false,
      used,
      limit,
      reason: "limit",
    };
  }

  return { allowed: true, isPro: false, isTodaysPick: false, used, limit };
}

/** Registra una lectura si el oyente puede acceder (idempotente por álbum/mes). */
export async function recordDossierView(
  identity: ListenerIdentity,
  albumId: string,
): Promise<void> {
  const key = listenerKey(identity);
  if (!key) return;

  const mk = monthKey();
  await prisma.dossierView.upsert({
    where: {
      albumId_listenerKey_monthKey: {
        albumId,
        listenerKey: key,
        monthKey: mk,
      },
    },
    create: {
      albumId,
      listenerKey: key,
      monthKey: mk,
      userId: identity.userId,
    },
    update: {},
  });
}

export async function getSubscriptionSummary(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      subscriptionEndsAt: true,
      stripeCustomerId: true,
    },
  });
}
