// Fase 5.2 — Rebobinada mensual: la IA te escribe una carta con tu mes musical.
// Solo narra sobre datos reales del oyente (reviews, moods, lecturas). Si el
// LLM falla, hay una carta determinista de respaldo: la app nunca se cae.

import { prisma } from "./db";
import { llm } from "./dossier/llm";
import {
  dedupeReviewsByAlbum,
  reviewsWhere,
  type ListenerIdentity,
} from "./identity";
import { listenerKey, monthKey } from "./freemium";

const LLM_TIMEOUT_MS = 12_000;

export type RewindStats = {
  monthLabel: string;
  albumsRead: number;
  reviews: { title: string; artist: string; rating: number }[];
  topMoods: string[];
  bestAlbum: { title: string; artist: string } | null;
};

export type RewindResult = {
  content: string;
  stats: RewindStats;
  monthKey: string;
};

function monthLabelEs(mk: string): string {
  const [y, m] = mk.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}

function monthRange(mk: string): { gte: Date; lt: Date } {
  const [y, m] = mk.split("-").map(Number);
  return { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
}

async function collectStats(
  identity: ListenerIdentity,
  mk: string,
): Promise<RewindStats | null> {
  const key = listenerKey(identity);
  if (!key) return null;

  const range = monthRange(mk);
  const reviewFilter = reviewsWhere(identity);

  const [views, rawReviews, picks] = await Promise.all([
    prisma.dossierView.count({ where: { listenerKey: key, monthKey: mk } }),
    reviewFilter
      ? prisma.review.findMany({
          where: { ...reviewFilter, createdAt: range },
          include: { album: { include: { artist: true } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.dailyPick.findMany({
      where: {
        mood: { not: null },
        date: { startsWith: mk },
        ...(identity.userId
          ? { userId: identity.userId }
          : { deviceId: identity.deviceId }),
      },
      select: { mood: true },
    }),
  ]);

  const reviews = dedupeReviewsByAlbum(rawReviews);
  if (views === 0 && reviews.length === 0) return null;

  const moodCount = new Map<string, number>();
  for (const p of picks) {
    if (p.mood) moodCount.set(p.mood, (moodCount.get(p.mood) ?? 0) + 1);
  }
  const topMoods = [...moodCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([mood]) => mood);

  const best = reviews.reduce<(typeof reviews)[number] | null>(
    (acc, r) => (acc == null || r.rating > acc.rating ? r : acc),
    null,
  );

  return {
    monthLabel: monthLabelEs(mk),
    albumsRead: views,
    reviews: reviews.map((r) => ({
      title: r.album.title,
      artist: r.album.artist.name,
      rating: r.rating,
    })),
    topMoods,
    bestAlbum: best ? { title: best.album.title, artist: best.album.artist.name } : null,
  };
}

/** Carta de respaldo sin LLM: siempre disponible. */
function fallbackLetter(stats: RewindStats): string {
  const parts: string[] = [];
  parts.push(
    `Tu ${stats.monthLabel} en Musicart: ${stats.albumsRead} ${
      stats.albumsRead === 1 ? "dossier leído" : "dossiers leídos"
    }${stats.reviews.length > 0 ? ` y ${stats.reviews.length} ${stats.reviews.length === 1 ? "reseña" : "reseñas"}` : ""}.`,
  );
  if (stats.bestAlbum) {
    parts.push(
      `El disco que más te marcó fue «${stats.bestAlbum.title}» de ${stats.bestAlbum.artist}.`,
    );
  }
  if (stats.topMoods.length > 0) {
    parts.push(`Tu ánimo dominante: ${stats.topMoods.join(", ")}.`);
  }
  parts.push("El mes que viene seguimos excavando la madriguera juntos.");
  return parts.join(" ");
}

async function writeLetter(stats: RewindStats): Promise<string> {
  const system = `Eres la voz de Musicart, una app de curaduría musical narrativa en español.
Escribes una carta breve, cálida y personal al oyente sobre su mes musical.
REGLAS ESTRICTAS:
- Usa SOLO los datos que se te dan. No inventes discos, artistas, fechas ni anécdotas.
- 120-180 palabras, segunda persona, tono melómano cercano, sin tecnicismos.
- No uses listas ni encabezados: prosa corrida, 2-3 párrafos.
- Cierra con una frase que invite a seguir el ritual el mes próximo.`;

  const user = `Datos reales del mes (${stats.monthLabel}):
- Dossiers leídos: ${stats.albumsRead}
- Reseñas: ${stats.reviews.map((r) => `«${r.title}» de ${r.artist} (${r.rating}★)`).join("; ") || "ninguna"}
- Disco mejor puntuado: ${stats.bestAlbum ? `«${stats.bestAlbum.title}» de ${stats.bestAlbum.artist}` : "ninguno"}
- Ánimos del check-in: ${stats.topMoods.join(", ") || "sin registros"}

Escribe la carta.`;

  const letter = await llm({
    system,
    user,
    temperature: 0.8,
    maxTokens: 500,
    timeoutMs: LLM_TIMEOUT_MS,
  });
  const trimmed = letter.trim();
  if (trimmed.length < 50) throw new Error("Carta demasiado corta");
  return trimmed;
}

function previousMonthKey(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return monthKey(d);
}

/**
 * Rebobinada de un mes COMPLETO: carta con IA, cacheada para siempre.
 * null = el oyente no tuvo actividad ese mes.
 */
async function getCompletedRewind(
  identity: ListenerIdentity,
  mk: string,
): Promise<RewindResult | null> {
  const key = listenerKey(identity);
  if (!key) return null;

  const cached = await prisma.rewind.findUnique({
    where: { listenerKey_monthKey: { listenerKey: key, monthKey: mk } },
  });
  if (cached) {
    return {
      content: cached.content,
      stats: JSON.parse(cached.statsJson) as RewindStats,
      monthKey: mk,
    };
  }

  const stats = await collectStats(identity, mk);
  if (!stats) return null;

  let content: string;
  try {
    content = await writeLetter(stats);
  } catch {
    content = fallbackLetter(stats);
  }

  await prisma.rewind.upsert({
    where: { listenerKey_monthKey: { listenerKey: key, monthKey: mk } },
    create: {
      listenerKey: key,
      monthKey: mk,
      content,
      statsJson: JSON.stringify(stats),
    },
    update: {},
  });

  return { content, stats, monthKey: mk };
}

export type RewindPageData = {
  rewind: RewindResult;
  inProgress: boolean; // true = mes en curso (resumen en vivo, sin LLM)
};

/**
 * Qué mostrar en /rebobinada: la carta del mes pasado (IA, cacheada) o,
 * si no hubo actividad, el resumen vivo del mes en curso (sin costo de LLM).
 */
export async function getRewindForPage(
  identity: ListenerIdentity,
): Promise<RewindPageData | null> {
  const previous = await getCompletedRewind(identity, previousMonthKey());
  if (previous) return { rewind: previous, inProgress: false };

  const mk = monthKey();
  const stats = await collectStats(identity, mk);
  if (!stats) return null;

  return {
    rewind: { content: fallbackLetter(stats), stats, monthKey: mk },
    inProgress: true,
  };
}
