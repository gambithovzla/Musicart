// Motor de recomendación personalizada (Fase 1).
// Elige un disco del catálogo publicado según el perfil del dispositivo,
// su diario de escuchas y el ánimo de hoy, y escribe el
// "por qué este disco, para ti, hoy".
//
// Regla de oro: si la IA falla por lo que sea (sin API key, timeout, JSON
// roto…), estas funciones devuelven null y la home cae a la rotación global.
// La app nunca se rompe por culpa del LLM.

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { todayKey } from "./daily";
import { llm, extractJson } from "./dossier/llm";
import { parseJson, type FactsPayload } from "./types";

const MAX_REVIEWS = 10; // últimas reseñas que entran como señal
const MAX_RECENT_PICKS = 7; // días recientes a evitar repetir
const LLM_TIMEOUT_MS = 4_000; // el criterio de la fase: pick en frío < 5 s

type DossierConAlbum = Prisma.DossierGetPayload<{
  include: { album: { include: { artist: true } } };
}>;

export type PickPersonal = {
  dossier: DossierConAlbum;
  reason: string | null;
  mood: string | null;
  regenerated: boolean;
};

/**
 * El pick del día para este dispositivo. Cache: una recomendación por device
 * por día (si ya existe en DailyPick se devuelve al instante, sin LLM).
 * Devuelve null si no hay señales del usuario o si la IA falla: el caller
 * debe caer a la rotación global (`getTodayPick`).
 */
export async function getPersonalizedPick(
  deviceId: string,
): Promise<PickPersonal | null> {
  if (!deviceId) return null;
  try {
    const date = todayKey();
    const guardado = await prisma.dailyPick.findUnique({
      where: { deviceId_date: { deviceId, date } },
    });
    if (guardado) {
      const dossier = await dossierDelAlbum(guardado.albumId);
      if (dossier) {
        return {
          dossier,
          reason: guardado.reason,
          mood: guardado.mood,
          regenerated: guardado.regenerated,
        };
      }
      // El álbum guardado ya no está publicado: se recalcula abajo.
    }
    return await recomendarYGuardar(deviceId, { mood: null });
  } catch (err) {
    console.error("[recommend] pick personalizado falló, va rotación global:", err);
    return null;
  }
}

/**
 * Check-in de ánimo. Si aún no hay pick hoy, lo genera con el mood como señal.
 * Si ya hay pick y todavía no se regeneró, se regenera UNA vez (control de
 * costo). Si ya se regeneró, solo se guarda el mood. Nunca lanza hacia la UI.
 */
export async function applyMood(
  deviceId: string,
  mood: string,
): Promise<{ ok: boolean }> {
  if (!deviceId || !mood) return { ok: false };
  try {
    const date = todayKey();
    const guardado = await prisma.dailyPick.findUnique({
      where: { deviceId_date: { deviceId, date } },
    });

    if (!guardado) {
      const pick = await recomendarYGuardar(deviceId, { mood });
      return { ok: pick !== null };
    }

    if (guardado.regenerated) {
      await prisma.dailyPick.update({
        where: { id: guardado.id },
        data: { mood },
      });
      return { ok: true };
    }

    const pick = await recomendarYGuardar(deviceId, {
      mood,
      albumPrevio: guardado.albumId,
      regenerated: true,
    });
    if (!pick) {
      // La IA falló: al menos queda registrado el ánimo (sin gastar la regeneración).
      await prisma.dailyPick.update({
        where: { id: guardado.id },
        data: { mood },
      });
    }
    return { ok: true };
  } catch (err) {
    console.error("[recommend] check-in de mood falló:", err);
    return { ok: false };
  }
}

async function dossierDelAlbum(albumId: string): Promise<DossierConAlbum | null> {
  return prisma.dossier.findFirst({
    where: { albumId, status: "published", locale: "es" },
    include: { album: { include: { artist: true } } },
  });
}

async function recomendarYGuardar(
  deviceId: string,
  opts: { mood: string | null; albumPrevio?: string; regenerated?: boolean },
): Promise<PickPersonal | null> {
  try {
    const date = todayKey();
    const [profile, reviews, catalogo, picksRecientes] = await Promise.all([
      prisma.profile.findUnique({ where: { deviceId } }),
      prisma.review.findMany({
        where: { deviceId },
        include: { album: { include: { artist: true } } },
        orderBy: { createdAt: "desc" },
        take: MAX_REVIEWS,
      }),
      prisma.dossier.findMany({
        where: { status: "published", locale: "es" },
        include: { album: { include: { artist: true } } },
        orderBy: { id: "asc" },
      }),
      prisma.dailyPick.findMany({
        where: { deviceId, date: { lt: date } },
        include: { album: { include: { artist: true } } },
        orderBy: { date: "desc" },
        take: MAX_RECENT_PICKS,
      }),
    ]);

    // Sin ninguna señal no hay nada que personalizar: rotación global.
    if (!profile && reviews.length === 0 && !opts.mood) return null;
    if (catalogo.length === 0) return null;

    const eleccion = await elegirConLlm({
      profile: profile ? parseJson<Record<string, unknown>>(profile.answersJson, {}) : null,
      reviews,
      mood: opts.mood,
      catalogo,
      picksRecientes,
      albumPrevio: opts.albumPrevio
        ? catalogo.find((d) => d.album.id === opts.albumPrevio) ?? null
        : null,
    });

    const dossier = catalogo.find((d) => d.album.id === eleccion.albumId);
    if (!dossier) {
      throw new Error(`El LLM eligió un albumId fuera del catálogo: ${eleccion.albumId}`);
    }
    const reason = eleccion.reason?.trim().slice(0, 600) || null;

    await prisma.dailyPick.upsert({
      where: { deviceId_date: { deviceId, date } },
      update: {
        albumId: dossier.album.id,
        reason,
        mood: opts.mood,
        regenerated: opts.regenerated ?? false,
      },
      create: {
        deviceId,
        date,
        albumId: dossier.album.id,
        reason,
        mood: opts.mood,
        regenerated: opts.regenerated ?? false,
      },
    });

    return {
      dossier,
      reason,
      mood: opts.mood,
      regenerated: opts.regenerated ?? false,
    };
  } catch (err) {
    console.error("[recommend] el motor falló, va rotación global:", err);
    return null;
  }
}

async function elegirConLlm(input: {
  profile: Record<string, unknown> | null;
  reviews: Prisma.ReviewGetPayload<{
    include: { album: { include: { artist: true } } };
  }>[];
  mood: string | null;
  catalogo: DossierConAlbum[];
  picksRecientes: Prisma.DailyPickGetPayload<{
    include: { album: { include: { artist: true } } };
  }>[];
  albumPrevio: DossierConAlbum | null;
}): Promise<{ albumId: string; reason: string }> {
  const catalogoTexto = input.catalogo
    .map((d) => {
      const facts = parseJson<Partial<FactsPayload>>(d.album.factsJson, {});
      const tags = facts.tags?.slice(0, 6).join(", ");
      return [
        `- albumId: ${d.album.id}`,
        `  "${d.album.title}" de ${d.album.artist.name} (${d.album.year})`,
        d.album.durationMin ? `  duración: ${d.album.durationMin} min` : null,
        tags ? `  etiquetas: ${tags}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const perfilTexto = input.profile
    ? JSON.stringify(input.profile)
    : "(sin perfil todavía)";

  const diarioTexto =
    input.reviews.length > 0
      ? input.reviews
          .map((r) => {
            const respuestas = Object.entries(
              parseJson<Record<string, string>>(r.answersJson, {}),
            )
              .filter(([, v]) => v.trim())
              .map(([q, v]) => `    · ${q} → "${v.slice(0, 140)}"`)
              .join("\n");
            return (
              `- "${r.album.title}" de ${r.album.artist.name}: ${r.rating}★` +
              (respuestas ? `\n${respuestas}` : "")
            );
          })
          .join("\n")
      : "(aún no ha reseñado ningún disco)";

  const recientesTexto =
    input.picksRecientes.length > 0
      ? input.picksRecientes
          .map((p) => `- ${p.date}: "${p.album.title}" de ${p.album.artist.name}`)
          .join("\n")
      : "(ninguno)";

  const regeneracionTexto = input.albumPrevio
    ? `\nHOY YA SE LE HABÍA RECOMENDADO: "${input.albumPrevio.album.title}" de ${input.albumPrevio.album.artist.name}, pero acaba de contarnos su ánimo. Puedes mantener ese disco si encaja con el ánimo (escribiendo una razón nueva que lo conecte) o elegir otro que encaje mejor.\n`
    : "";

  const system = `Eres el curador musical de Musicart: cercano, melómano, hablas en español y de "tú".
Tu trabajo: elegir UN disco del catálogo para este usuario hoy, y explicar por qué ese disco, para él/ella, hoy.

Reglas estrictas:
1. Responde SOLO un objeto JSON: {"albumId": "...", "reason": "..."} — sin texto extra.
2. "albumId" debe ser EXACTAMENTE uno de los albumId del catálogo.
3. "reason": 1 a 3 frases en español, cálidas y concretas, citando SOLO señales reales del usuario que aparecen abajo (sus estrellas, sus respuestas, su perfil, su ánimo de hoy). Ej.: "Le diste 5★ a X…", "dijiste que buscas la historia…".
4. Sobre el disco solo puedes mencionar lo que aparece en el catálogo (título, artista, año, duración, etiquetas). PROHIBIDO inventar datos del álbum o del usuario.
5. Evita repetir discos recomendados en días recientes, salvo que no haya alternativa razonable.
6. Si el usuario indicó su ánimo de hoy, dale prioridad como señal.`;

  const user = `CATÁLOGO DISPONIBLE (elige uno por su albumId):
${catalogoTexto}

PERFIL DEL USUARIO:
${perfilTexto}

SU DIARIO (reseñas recientes, de la más nueva a la más vieja):
${diarioTexto}

ÁNIMO DE HOY: ${input.mood ?? "(no indicado)"}
${regeneracionTexto}
DISCOS RECOMENDADOS EN DÍAS RECIENTES (evítalos si puedes):
${recientesTexto}

Responde el JSON ahora.`;

  const raw = await llm({
    system,
    user,
    temperature: 0.4,
    maxTokens: 300,
    timeoutMs: LLM_TIMEOUT_MS,
  });
  const parsed = extractJson<{ albumId?: string; reason?: string }>(raw);
  if (!parsed.albumId || !parsed.reason) {
    throw new Error(`Respuesta del LLM incompleta: ${raw.slice(0, 200)}`);
  }
  return { albumId: parsed.albumId, reason: parsed.reason };
}
