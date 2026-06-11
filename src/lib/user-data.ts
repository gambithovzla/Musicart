// Fase 3.4: exportación y borrado de datos del oyente (cuenta o dispositivo anónimo).

import { prisma } from "./db";
import {
  type ListenerIdentity,
  dedupeReviewsByAlbum,
  profileWhere,
  reviewsWhere,
} from "./identity";
import { parseJson } from "./types";

export type UserDataExport = {
  exportedAt: string;
  version: 1;
  account: {
    email: string;
    name: string | null;
    createdAt: string;
  } | null;
  profile: {
    answers: Record<string, unknown>;
    createdAt: string;
  } | null;
  reviews: {
    albumId: string;
    title: string;
    artist: string;
    year: number;
    rating: number;
    answers: Record<string, string>;
    date: string;
  }[];
  dailyPicks: {
    date: string;
    title: string;
    artist: string;
    year: number;
    reason: string | null;
    mood: string | null;
  }[];
};

function picksWhere(identity: ListenerIdentity) {
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

export async function buildUserDataExport(
  identity: ListenerIdentity,
  account?: { email: string; name: string | null; createdAt: Date } | null,
): Promise<UserDataExport> {
  const reviewFilter = reviewsWhere(identity);
  const profileFilter = profileWhere(identity);
  const pickFilter = picksWhere(identity);

  const [profile, reviews, picks] = await Promise.all([
    profileFilter
      ? prisma.profile.findFirst({ where: profileFilter })
      : Promise.resolve(null),
    reviewFilter
      ? prisma.review.findMany({
          where: reviewFilter,
          include: { album: { include: { artist: true } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    pickFilter
      ? prisma.dailyPick.findMany({
          where: pickFilter,
          include: { album: { include: { artist: true } } },
          orderBy: { date: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    account: account
      ? {
          email: account.email,
          name: account.name,
          createdAt: account.createdAt.toISOString(),
        }
      : null,
    profile: profile
      ? {
          answers: parseJson<Record<string, unknown>>(profile.answersJson, {}),
          createdAt: profile.createdAt.toISOString(),
        }
      : null,
    reviews: dedupeReviewsByAlbum(reviews).map((r) => ({
      albumId: r.albumId,
      title: r.album.title,
      artist: r.album.artist.name,
      year: r.album.year,
      rating: r.rating,
      answers: parseJson<Record<string, string>>(r.answersJson, {}),
      date: r.createdAt.toISOString(),
    })),
    dailyPicks: picks.map((p) => ({
      date: p.date,
      title: p.album.title,
      artist: p.album.artist.name,
      year: p.album.year,
      reason: p.reason,
      mood: p.mood,
    })),
  };
}

/** Borra perfil, diario y picks del oyente. Si deleteAccount, elimina también la cuenta Auth. */
export async function purgeListenerData(
  identity: ListenerIdentity,
  deleteAccount: boolean,
): Promise<void> {
  const reviewFilter = reviewsWhere(identity);
  const profileFilter = profileWhere(identity);
  const pickFilter = picksWhere(identity);

  if (reviewFilter) {
    await prisma.review.deleteMany({ where: reviewFilter });
  }
  if (pickFilter) {
    await prisma.dailyPick.deleteMany({ where: pickFilter });
  }
  if (profileFilter) {
    await prisma.profile.deleteMany({ where: profileFilter });
  }

  if (deleteAccount && identity.userId) {
    await prisma.user.delete({ where: { id: identity.userId } });
  }
}
