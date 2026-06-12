// Fase 5.4 — El hilo de tu vida musical: conecta reseñas del diario entre sí.
// Solo narra sobre lo que el oyente escribió + metadatos del disco. Si el LLM
// falla, hay texto determinista de respaldo: la app nunca se cae.

import { prisma } from "./db";
import { llm } from "./dossier/llm";
import {
  dedupeReviewsByAlbum,
  reviewsWhere,
  type ListenerIdentity,
} from "./identity";
import { listenerKey } from "./freemium";
import { LOVED_THRESHOLD, RATING_MAX, splitAnswers } from "./review";

const LLM_TIMEOUT_MS = 10_000;
const MAX_REVIEWS = 10;
const MIN_REVIEWS = 2;

export type ThreadEntry = {
  albumId: string;
  title: string;
  artist: string;
  year: number;
  rating: number;
  reflection: string;
  whenLabel: string;
};

function extractReflection(answersJson: string): string {
  try {
    const answers = JSON.parse(answersJson) as Record<string, string>;
    // Prioriza el comentario libre; la canción favorita no es una reflexión.
    const { comment, reflections } = splitAnswers(answers);
    return (comment.trim() || Object.values(reflections).find((a) => a.trim())?.trim()) ?? "";
  } catch {
    return "";
  }
}

function whenLabel(iso: string): string {
  const days = Math.floor(
    (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) {
    return weeks === 1 ? "hace 1 semana" : `hace ${weeks} semanas`;
  }
  const months = Math.floor(days / 30);
  return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
}

function fingerprint(
  reviews: { albumId: string; rating: number; answersJson: string }[],
): string {
  return reviews
    .map((r) => `${r.albumId}:${r.rating}:${r.answersJson}`)
    .sort()
    .join("|");
}

type ReviewRow = Awaited<
  ReturnType<
    typeof prisma.review.findMany<{
      include: { album: { include: { artist: true } } };
    }>
  >
>[number];

function toEntries(reviews: ReviewRow[]): ThreadEntry[] {
  return reviews.map((r) => ({
    albumId: r.albumId,
    title: r.album.title,
    artist: r.album.artist.name,
    year: r.album.year,
    rating: r.rating,
    reflection: extractReflection(r.answersJson),
    whenLabel: whenLabel(r.createdAt.toISOString()),
  }));
}

/** Texto de respaldo sin LLM: enlaza cronología y reflexiones reales. */
export function fallbackThread(entries: ThreadEntry[]): string {
  const withText = entries.filter((e) => e.reflection);
  const newest = entries[0];
  const oldest = entries[entries.length - 1];

  if (withText.length >= 2) {
    const [a, b] = withText.slice(0, 2);
    return `${a.whenLabel.charAt(0).toUpperCase() + a.whenLabel.slice(1)} dejaste una nota sobre «${a.title}»: “${truncate(a.reflection, 80)}”. Ahora «${b.title}» vive en el mismo hilo — dos escuchas que se responden en tu diario.`;
  }

  if (withText.length === 1) {
    const a = withText[0];
    return `Tu diario ya guarda ${entries.length} discos. ${a.whenLabel.charAt(0).toUpperCase() + a.whenLabel.slice(1)} escribiste sobre «${a.title}»; «${newest.title}» es la parada más reciente del viaje.`;
  }

  const high = entries.filter((e) => e.rating >= LOVED_THRESHOLD);
  if (high.length >= 2) {
    return `Entre «${oldest.title}» (${oldest.whenLabel}) y «${newest.title}» (${newest.whenLabel}) llevas ${entries.length} paradas. Los que más brillan: ${high
      .slice(0, 3)
      .map((e) => `«${e.title}»`)
      .join(" y ")}.`;
  }

  return `Tu hilo musical ya tiene ${entries.length} discos — de «${oldest.title}» a «${newest.title}». Cada reseña que dejes hace que la próxima conexión sea más tuya.`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

async function writeThread(entries: ThreadEntry[]): Promise<string> {
  const system = `Eres la voz de Musicart, curaduría musical narrativa en español.
Conectas las experiencias de escucha de un oyente leyendo su diario.
REGLAS ESTRICTAS:
- Usa SOLO los datos que se te dan: títulos, artistas, años, estrellas y el texto exacto de sus reflexiones.
- No inventes hechos sobre los discos, la biografía del artista ni la vida del oyente.
- No cites Wikipedia ni anécdotas externas: solo lo que el oyente escribió.
- 2-4 oraciones, segunda persona, tono melómano cercano, prosa corrida (sin listas).
- Si hay reflexiones con emociones parecidas (ruptura, nostalgia, energía…), enlázalas con delicadeza.
- Si una reflexión es antigua y otra reciente, puedes usar las etiquetas temporales dadas.`;

  const lines = entries.map(
    (e) =>
      `- ${e.whenLabel}: «${e.title}» de ${e.artist} (${e.year}), ${e.rating}/${RATING_MAX}${
        e.reflection ? ` — reflexión: “${e.reflection}”` : ""
      }`,
  );

  const user = `Entradas del diario (de la más reciente a la más antigua):
${lines.join("\n")}

Escribe el hilo que conecta estas escuchas.`;

  const text = await llm({
    system,
    user,
    temperature: 0.75,
    maxTokens: 280,
    timeoutMs: LLM_TIMEOUT_MS,
  });
  const trimmed = text.trim();
  if (trimmed.length < 40) throw new Error("Hilo demasiado corto");
  return trimmed;
}

export type MusicalThreadResult = {
  content: string;
  entryCount: number;
};

/**
 * Hilo musical del oyente. null si hay menos de 2 reseñas.
 * Cacheado por fingerprint: solo llama al LLM cuando cambia el diario.
 */
export async function getMusicalThread(
  identity: ListenerIdentity,
): Promise<MusicalThreadResult | null> {
  const key = listenerKey(identity);
  if (!key) return null;

  const where = reviewsWhere(identity);
  if (!where) return null;

  const raw = await prisma.review.findMany({
    where,
    include: { album: { include: { artist: true } } },
    orderBy: { createdAt: "desc" },
    take: MAX_REVIEWS,
  });
  const reviews = dedupeReviewsByAlbum(raw);
  if (reviews.length < MIN_REVIEWS) return null;

  const fp = fingerprint(reviews);
  const cached = await prisma.musicalThread.findUnique({
    where: { listenerKey: key },
  });
  if (cached && cached.fingerprint === fp) {
    return { content: cached.content, entryCount: reviews.length };
  }

  const entries = toEntries(reviews);

  let content: string;
  try {
    content = await writeThread(entries);
  } catch {
    content = fallbackThread(entries);
  }

  await prisma.musicalThread.upsert({
    where: { listenerKey: key },
    create: { listenerKey: key, content, fingerprint: fp },
    update: { content, fingerprint: fp },
  });

  return { content, entryCount: entries.length };
}
