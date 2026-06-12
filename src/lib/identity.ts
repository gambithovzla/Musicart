// Fase 3.3: identidad del oyente — userId si hay sesión, deviceId como respaldo anónimo.

import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DEVICE_COOKIE } from "./device";

export type ListenerIdentity = {
  deviceId: string;
  userId: string | null;
};

export async function getListenerIdentity(): Promise<ListenerIdentity> {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  return {
    deviceId: cookieStore.get(DEVICE_COOKIE)?.value ?? "",
    userId: session?.user?.id ?? null,
  };
}

export function hasListener(identity: ListenerIdentity): boolean {
  return Boolean(identity.userId || identity.deviceId);
}

/** Filtro de reseñas: por cuenta si hay sesión; si no, por dispositivo. */
export function reviewsWhere(
  identity: ListenerIdentity,
): Prisma.ReviewWhereInput | null {
  if (identity.userId) {
    return {
      OR: [
        { userId: identity.userId },
        ...(identity.deviceId ? [{ deviceId: identity.deviceId }] : []),
      ],
    };
  }
  if (identity.deviceId) return { deviceId: identity.deviceId };
  return null;
}

/** Filtro de perfil: cuenta primero, luego dispositivo. */
export function profileWhere(
  identity: ListenerIdentity,
): Prisma.ProfileWhereInput | null {
  if (identity.userId) {
    return {
      OR: [
        { userId: identity.userId },
        ...(identity.deviceId ? [{ deviceId: identity.deviceId }] : []),
      ],
    };
  }
  if (identity.deviceId) return { deviceId: identity.deviceId };
  return null;
}

/** Filtro de picks pasados (no incluye el día actual). */
export function pastPicksWhere(
  identity: ListenerIdentity,
  beforeDate: string,
): Prisma.DailyPickWhereInput | null {
  if (identity.userId) {
    return { userId: identity.userId, date: { lt: beforeDate } };
  }
  if (identity.deviceId) {
    return { deviceId: identity.deviceId, date: { lt: beforeDate } };
  }
  return null;
}

/** Una reseña por álbum (la más reciente gana). */
export function dedupeReviewsByAlbum<
  T extends { albumId: string; createdAt: Date },
>(reviews: T[]): T[] {
  const byAlbum = new Map<string, T>();
  for (const r of reviews) {
    const prev = byAlbum.get(r.albumId);
    if (!prev || r.createdAt > prev.createdAt) byAlbum.set(r.albumId, r);
  }
  return [...byAlbum.values()].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

/** Perfil canónico: con sesión, el ligado a la cuenta (viaja entre dispositivos). */
export async function findProfileRecord(identity: ListenerIdentity) {
  if (identity.userId) {
    const byUser = await prisma.profile.findUnique({
      where: { userId: identity.userId },
    });
    if (byUser) return byUser;
  }
  if (identity.deviceId) {
    return prisma.profile.findUnique({ where: { deviceId: identity.deviceId } });
  }
  return null;
}
