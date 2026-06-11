// Fase 4.6 — métricas de producto desde la base de datos (solo admin).

import { prisma } from "./db";
import { todayKey } from "./daily";
import { freemiumLimit, monthKey } from "./freemium";

export type ProductMetrics = {
  period: { days7: string; days30: string; month: string };
  users: {
    total: number;
    newLast7d: number;
    proActive: number;
  };
  engagement: {
    dossierViews7d: number;
    dossierViews30d: number;
    uniqueListeners7d: number;
    reviewsTotal: number;
    reviews7d: number;
    avgRating: number | null;
    profilesTotal: number;
    atFreemiumLimit: number;
  };
  ritual: {
    dailyPicks7d: number;
    moods: { mood: string; count: number }[];
  };
  catalog: {
    published: number;
    drafts: number;
    queuePending: number;
    queueFailed: number;
  };
  topAlbums30d: { title: string; artist: string; views: number }[];
};

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKeysLastNDays(n: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(todayKey(d));
  }
  return keys;
}

export async function getProductMetrics(): Promise<ProductMetrics> {
  const since7 = daysAgo(7);
  const since30 = daysAgo(30);
  const mk = monthKey();
  const limit = freemiumLimit();
  const pickDates7 = dateKeysLastNDays(7);

  const [
    usersTotal,
    usersNew7d,
    proActive,
    dossierViews7d,
    dossierViews30d,
    uniqueListeners7d,
    reviewsTotal,
    reviews7d,
    ratingAgg,
    profilesTotal,
    dailyPicks7d,
    moodGroups,
    published,
    drafts,
    queuePending,
    queueFailed,
    topGroups,
    monthViewGroups,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since7 } } }),
    prisma.user.count({
      where: { subscriptionStatus: { in: ["active", "trialing"] } },
    }),
    prisma.dossierView.count({ where: { createdAt: { gte: since7 } } }),
    prisma.dossierView.count({ where: { createdAt: { gte: since30 } } }),
    prisma.dossierView
      .groupBy({
        by: ["listenerKey"],
        where: { createdAt: { gte: since7 } },
      })
      .then((g) => g.length),
    prisma.review.count(),
    prisma.review.count({ where: { createdAt: { gte: since7 } } }),
    prisma.review.aggregate({ _avg: { rating: true } }),
    prisma.profile.count(),
    prisma.dailyPick.count({ where: { date: { in: pickDates7 } } }),
    prisma.dailyPick.groupBy({
      by: ["mood"],
      where: { mood: { not: null }, date: { in: dateKeysLastNDays(30) } },
      _count: { mood: true },
      orderBy: { _count: { mood: "desc" } },
    }),
    prisma.dossier.count({ where: { status: "published", locale: "es" } }),
    prisma.dossier.count({ where: { status: "draft", locale: "es" } }),
    prisma.generationQueue.count({ where: { status: "pending" } }),
    prisma.generationQueue.count({ where: { status: "failed" } }),
    prisma.dossierView.groupBy({
      by: ["albumId"],
      where: { createdAt: { gte: since30 } },
      _count: { albumId: true },
      orderBy: { _count: { albumId: "desc" } },
      take: 5,
    }),
    prisma.dossierView.groupBy({
      by: ["listenerKey"],
      where: { monthKey: mk },
      _count: { albumId: true },
    }),
  ]);

  const albumIds = topGroups.map((g) => g.albumId);
  const albums =
    albumIds.length > 0
      ? await prisma.album.findMany({
          where: { id: { in: albumIds } },
          include: { artist: true },
        })
      : [];
  const albumMap = new Map(albums.map((a) => [a.id, a]));

  const topAlbums30d = topGroups.map((g) => {
    const a = albumMap.get(g.albumId);
    return {
      title: a?.title ?? g.albumId,
      artist: a?.artist.name ?? "—",
      views: g._count.albumId,
    };
  });

  const moods = moodGroups
    .filter((m): m is typeof m & { mood: string } => m.mood != null)
    .map((m) => ({ mood: m.mood, count: m._count.mood }));

  const atFreemiumLimit = monthViewGroups.filter(
    (g) => g._count.albumId >= limit,
  ).length;

  return {
    period: {
      days7: since7.toISOString().slice(0, 10),
      days30: since30.toISOString().slice(0, 10),
      month: mk,
    },
    users: { total: usersTotal, newLast7d: usersNew7d, proActive },
    engagement: {
      dossierViews7d,
      dossierViews30d,
      uniqueListeners7d,
      reviewsTotal,
      reviews7d,
      avgRating: ratingAgg._avg.rating,
      profilesTotal,
      atFreemiumLimit,
    },
    ritual: { dailyPicks7d, moods },
    catalog: { published, drafts, queuePending, queueFailed },
    topAlbums30d,
  };
}
