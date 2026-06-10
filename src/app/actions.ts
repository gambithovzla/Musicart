"use server";

// Server actions del loop diario: reflexiones, perfil y diario del melómano.

import { prisma } from "@/lib/db";

export async function saveReview(input: {
  deviceId: string;
  albumId: string;
  rating: number;
  answers: Record<string, string>;
}) {
  if (!input.deviceId || !input.albumId) throw new Error("Datos incompletos");
  const rating = Math.min(5, Math.max(1, Math.round(input.rating)));
  await prisma.review.upsert({
    where: {
      deviceId_albumId: { deviceId: input.deviceId, albumId: input.albumId },
    },
    update: { rating, answersJson: JSON.stringify(input.answers) },
    create: {
      deviceId: input.deviceId,
      albumId: input.albumId,
      rating,
      answersJson: JSON.stringify(input.answers),
    },
  });
  return { ok: true };
}

export async function getReview(deviceId: string, albumId: string) {
  if (!deviceId) return null;
  const review = await prisma.review.findUnique({
    where: { deviceId_albumId: { deviceId, albumId } },
  });
  if (!review) return null;
  return {
    rating: review.rating,
    answers: JSON.parse(review.answersJson) as Record<string, string>,
  };
}

export async function saveProfile(deviceId: string, answers: Record<string, unknown>) {
  if (!deviceId) throw new Error("Sin deviceId");
  await prisma.profile.upsert({
    where: { deviceId },
    update: { answersJson: JSON.stringify(answers) },
    create: { deviceId, answersJson: JSON.stringify(answers) },
  });
  return { ok: true };
}

export async function getJournal(deviceId: string) {
  if (!deviceId) return [];
  const reviews = await prisma.review.findMany({
    where: { deviceId },
    include: { album: { include: { artist: true } } },
    orderBy: { createdAt: "desc" },
  });
  return reviews.map((r) => ({
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
