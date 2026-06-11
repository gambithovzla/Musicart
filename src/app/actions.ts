"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { TZ_COOKIE } from "@/lib/device";
import type { CuriosityAnswer } from "@/lib/curiosities";
import { parseJson } from "@/lib/types";
import {
  dedupeReviewsByAlbum,
  getListenerIdentity,
  hasListener,
  profileWhere,
  reviewsWhere,
} from "@/lib/identity";
import { applyMood } from "@/lib/recommend";

export async function saveReview(input: {
  deviceId: string;
  albumId: string;
  rating: number;
  answers: Record<string, string>;
}) {
  if (!input.deviceId || !input.albumId) throw new Error("Datos incompletos");
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const rating = Math.min(5, Math.max(1, Math.round(input.rating)));
  const answersJson = JSON.stringify(input.answers);

  if (userId) {
    const existing = await prisma.review.findFirst({
      where: { userId, albumId: input.albumId },
    });
    if (existing) {
      await prisma.review.update({
        where: { id: existing.id },
        data: { rating, answersJson },
      });
      return { ok: true };
    }
  }

  await prisma.review.upsert({
    where: {
      deviceId_albumId: { deviceId: input.deviceId, albumId: input.albumId },
    },
    update: { rating, answersJson, ...(userId ? { userId } : {}) },
    create: {
      deviceId: input.deviceId,
      albumId: input.albumId,
      rating,
      answersJson,
      userId,
    },
  });
  return { ok: true };
}

export async function getReview(albumId: string) {
  const identity = await getListenerIdentity();
  if (!hasListener(identity)) return null;

  const where = reviewsWhere(identity);
  if (!where) return null;

  const review = await prisma.review.findFirst({
    where: { ...where, albumId },
    orderBy: { createdAt: "desc" },
  });
  if (!review) return null;
  return {
    rating: review.rating,
    answers: JSON.parse(review.answersJson) as Record<string, string>,
  };
}

export async function saveProfile(deviceId: string, answers: Record<string, unknown>) {
  if (!deviceId) throw new Error("Sin deviceId");
  const session = await auth();
  const userId = session?.user?.id ?? null;
  await prisma.profile.upsert({
    where: { deviceId },
    update: {
      answersJson: JSON.stringify(answers),
      ...(userId ? { userId } : {}),
    },
    create: {
      deviceId,
      answersJson: JSON.stringify(answers),
      userId: userId ?? null,
    },
  });
  return { ok: true };
}

export async function checkInMood(deviceId: string, mood: string) {
  if (!deviceId || !mood.trim()) return { ok: false };
  const [session, jar] = await Promise.all([auth(), cookies()]);
  const tzRaw = jar.get(TZ_COOKIE)?.value;
  const tz = tzRaw ? decodeURIComponent(tzRaw) : null;
  return applyMood(deviceId, mood.trim().slice(0, 40), session?.user?.id, tz);
}

export async function getJournal() {
  const identity = await getListenerIdentity();
  const where = reviewsWhere(identity);
  if (!where) return [];

  const reviews = await prisma.review.findMany({
    where,
    include: { album: { include: { artist: true } } },
    orderBy: { createdAt: "desc" },
  });

  return dedupeReviewsByAlbum(reviews).map((r) => ({
    albumId: r.albumId,
    title: r.album.title,
    artist: r.album.artist.name,
    year: r.album.year,
    coverUrl: r.album.coverUrl,
    rating: r.rating,
    answers: JSON.parse(r.answersJson) as Record<string, string>,
    date: r.createdAt.toISOString(),
  }));
}

export async function hasProfile(): Promise<boolean> {
  const identity = await getListenerIdentity();
  const where = profileWhere(identity);
  if (!where) return false;
  return Boolean(await prisma.profile.findFirst({ where, select: { id: true } }));
}

/** Guarda una respuesta a la pregunta del día en el perfil del usuario. */
export async function answerCuriosity(
  deviceId: string,
  answer: CuriosityAnswer,
): Promise<{ ok: boolean }> {
  if (!deviceId || !answer.id || !answer.answer) return { ok: false };
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const identity = await getListenerIdentity();
  const where = profileWhere(identity);
  const existing = where
    ? await prisma.profile.findFirst({ where })
    : null;

  const prev = existing
    ? parseJson<Record<string, unknown>>(existing.answersJson, {})
    : {};
  const prevAnswers: CuriosityAnswer[] = Array.isArray(prev.curiosities)
    ? (prev.curiosities as CuriosityAnswer[])
    : [];

  // No duplicar la misma pregunta en el mismo día.
  const filtered = prevAnswers.filter(
    (a) => !(a.id === answer.id && a.date === answer.date),
  );
  const updated = { ...prev, curiosities: [...filtered, answer] };

  await prisma.profile.upsert({
    where: { deviceId },
    update: {
      answersJson: JSON.stringify(updated),
      ...(userId ? { userId } : {}),
    },
    create: {
      deviceId,
      answersJson: JSON.stringify(updated),
      userId: userId ?? null,
    },
  });
  return { ok: true };
}
