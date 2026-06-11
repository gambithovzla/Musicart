"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { TZ_COOKIE } from "@/lib/device";
import type { CuriosityAnswer, CuriosityQuestion } from "@/lib/curiosities";
import { QUESTIONS, todayQuestion, formatCuriosities } from "@/lib/curiosities";
import { parseJson } from "@/lib/types";
import { llm, extractJson } from "@/lib/dossier/llm";
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

/**
 * Devuelve la pregunta del día generada por IA para este usuario.
 * Está cacheada en profile.todayCuriosity; si no existe o es de ayer,
 * la genera con el LLM (fallback: pregunta estática si el LLM falla o tarda).
 */
export async function getCuriosityQuestion(
  dateKey: string,
): Promise<CuriosityQuestion | null> {
  const identity = await getListenerIdentity();
  const where = profileWhere(identity);
  if (!where) return null;
  const profile = await prisma.profile.findFirst({ where });
  if (!profile) return null;

  const data = parseJson<Record<string, unknown>>(profile.answersJson, {});

  // ¿Tenemos una pregunta cacheada de hoy?
  const cached = data.todayCuriosity as
    | { date: string; id: string; text: string; options: string[] }
    | undefined;
  if (cached?.date === dateKey && cached.text && Array.isArray(cached.options)) {
    return { id: cached.id, text: cached.text, options: cached.options };
  }

  // Contexto para el LLM.
  const prevAnswers: CuriosityAnswer[] = Array.isArray(data.curiosities)
    ? (data.curiosities as CuriosityAnswer[])
    : [];
  const recentAnswers = prevAnswers.slice(-15);
  const answeredContext =
    recentAnswers.length > 0
      ? formatCuriosities(recentAnswers)
      : "(ninguna todavía)";

  const genres = Array.isArray(data.genres) ? (data.genres as string[]).join(", ") : "";
  const artists = Array.isArray(data.artists)
    ? (data.artists as string[]).slice(0, 5).join(", ")
    : "";
  const interests = Array.isArray(data.interests) ? (data.interests as string[]).join(", ") : "";
  const bio = typeof data.bio === "string" ? data.bio.trim() : "";

  const profileSummary = [
    genres ? `Géneros: ${genres}` : null,
    artists ? `Artistas favoritos: ${artists}` : null,
    interests ? `Intereses: ${interests}` : null,
    bio ? `Contexto: "${bio}"` : null,
  ]
    .filter(Boolean)
    .join("; ") || "(perfil básico)";

  const fallback = todayQuestion(
    new Set(recentAnswers.map((a) => a.id)),
    dateKey,
  );

  let generated: CuriosityQuestion | null = null;
  try {
    const raw = await llm({
      system: `Eres el amigo personal de Musicart. Cada día le haces UNA pregunta al usuario para conocerlo mejor.
Las preguntas pueden ser sobre música, pero también sobre vida, emociones, recuerdos, rutinas, sueños — varía.
El objetivo: que el sistema te conozca tan bien como un amigo de toda la vida.
Reglas:
- Pregunta breve (máx. 10 palabras), íntima pero no invasiva.
- 4 a 6 opciones de respuesta cortas (máx. 5 palabras cada una).
- NO repitas preguntas que ya le hiciste.
- Varía el tema respecto a las últimas preguntas.
Responde SOLO este JSON (sin texto extra):
{"id": "slug-unico", "text": "¿Pregunta...?", "options": ["Op1", "Op2", "Op3", "Op4"]}`,
      user: `Lo que sé de este usuario:
${profileSummary}

Preguntas que ya le hice (NO repetir temas similares):
${answeredContext}

Genera una pregunta nueva ahora.`,
      temperature: 0.9,
      maxTokens: 200,
      timeoutMs: 3_500,
    });

    const parsed = extractJson<{ id?: string; text?: string; options?: string[] }>(raw);
    if (parsed.text && Array.isArray(parsed.options) && parsed.options.length >= 2) {
      generated = {
        id: parsed.id ?? `ai-${dateKey}`,
        text: parsed.text.trim(),
        options: parsed.options.slice(0, 6).map((o) => String(o).trim()),
      };
    }
  } catch {
    // Sin API key o timeout: devolvemos fallback estático.
  }

  const question = generated ?? fallback;
  if (!question) return null;

  // Cachear en el perfil para el resto del día (sin volver a llamar al LLM).
  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      answersJson: JSON.stringify({
        ...data,
        todayCuriosity: { date: dateKey, ...question },
      }),
    },
  });

  return question;
}
