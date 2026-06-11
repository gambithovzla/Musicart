// Motor de recomendación personalizada (Fase 1 + 3.3).
// Con sesión lee/escribe por userId; sin sesión, por deviceId.

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { todayKey } from "./daily";
import { llm, extractJson } from "./dossier/llm";
import {
  type ListenerIdentity,
  pastPicksWhere,
  profileWhere,
  reviewsWhere,
} from "./identity";
import {
  detectReturnRitual,
  fallbackReturnReason,
  type ReturnRitual,
} from "./return-ritual";
import { parseJson, type FactsPayload } from "./types";

const MAX_REVIEWS = 10;
const MAX_RECENT_PICKS = 7;
const LLM_TIMEOUT_MS = 4_000;

type DossierConAlbum = Prisma.DossierGetPayload<{
  include: { album: { include: { artist: true } } };
}>;

export type PickPersonal = {
  dossier: DossierConAlbum;
  reason: string | null;
  mood: string | null;
  regenerated: boolean;
  returnPick: boolean;
  absenceDays: number | null;
};

type PickCtx = { deviceId: string; userId: string | null };

async function findTodaysPick(ctx: PickCtx, date: string) {
  if (ctx.userId) {
    const byUser = await prisma.dailyPick.findFirst({
      where: { userId: ctx.userId, date },
      orderBy: { id: "desc" },
    });
    if (byUser) return byUser;
  }
  if (!ctx.deviceId) return null;
  return prisma.dailyPick.findUnique({
    where: { deviceId_date: { deviceId: ctx.deviceId, date } },
  });
}

async function saveTodaysPick(
  ctx: PickCtx,
  date: string,
  data: {
    albumId: string;
    reason: string | null;
    mood: string | null;
    regenerated: boolean;
    returnPick?: boolean;
    absenceDays?: number | null;
  },
) {
  const existing = await findTodaysPick(ctx, date);
  if (existing) {
    return prisma.dailyPick.update({
      where: { id: existing.id },
      data: {
        albumId: data.albumId,
        reason: data.reason,
        mood: data.mood,
        regenerated: data.regenerated,
        returnPick: data.returnPick ?? false,
        absenceDays: data.absenceDays ?? null,
        ...(ctx.userId ? { userId: ctx.userId } : {}),
      },
    });
  }
  if (!ctx.deviceId) return null;
  return prisma.dailyPick.create({
    data: {
      deviceId: ctx.deviceId,
      userId: ctx.userId,
      date,
      albumId: data.albumId,
      reason: data.reason,
      mood: data.mood,
      regenerated: data.regenerated,
      returnPick: data.returnPick ?? false,
      absenceDays: data.absenceDays ?? null,
    },
  });
}

/**
 * Pick del día. Con sesión, comparte el mismo disco entre dispositivos.
 */
export async function getPersonalizedPick(
  deviceId: string,
  userId?: string | null,
  tz?: string | null,
): Promise<PickPersonal | null> {
  const ctx: PickCtx = { deviceId, userId: userId ?? null };
  if (!ctx.deviceId && !ctx.userId) return null;
  try {
    const date = todayKey(tz);
    const guardado = await findTodaysPick(ctx, date);
    if (guardado) {
      const dossier = await dossierDelAlbum(guardado.albumId);
      if (dossier) {
        return {
          dossier,
          reason: guardado.reason,
          mood: guardado.mood,
          regenerated: guardado.regenerated,
          returnPick: guardado.returnPick,
          absenceDays: guardado.absenceDays,
        };
      }
    }
    return await recomendarYGuardar(ctx, { mood: null }, tz);
  } catch (err) {
    console.error("[recommend] pick personalizado falló, va rotación global:", err);
    return null;
  }
}

export async function applyMood(
  deviceId: string,
  mood: string,
  userId?: string | null,
  tz?: string | null,
): Promise<{ ok: boolean }> {
  const ctx: PickCtx = { deviceId, userId: userId ?? null };
  if ((!ctx.deviceId && !ctx.userId) || !mood) return { ok: false };
  try {
    const date = todayKey(tz);
    const guardado = await findTodaysPick(ctx, date);

    if (!guardado) {
      const pick = await recomendarYGuardar(ctx, { mood }, tz);
      return { ok: pick !== null };
    }

    if (guardado.regenerated) {
      await prisma.dailyPick.update({
        where: { id: guardado.id },
        data: { mood },
      });
      return { ok: true };
    }

    const pick = await recomendarYGuardar(ctx, {
      mood,
      albumPrevio: guardado.albumId,
      regenerated: true,
    }, tz);
    if (!pick) {
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
  ctx: PickCtx,
  opts: { mood: string | null; albumPrevio?: string; regenerated?: boolean },
  tz?: string | null,
): Promise<PickPersonal | null> {
  try {
    const date = todayKey(tz);
    const identity: ListenerIdentity = {
      deviceId: ctx.deviceId,
      userId: ctx.userId,
    };
    const profileFilter = profileWhere(identity);
    const reviewFilter = reviewsWhere(identity);
    const pastFilter = pastPicksWhere(identity, date);

    const [profile, reviews, catalogo, picksRecientes] = await Promise.all([
      profileFilter
        ? prisma.profile.findFirst({ where: profileFilter })
        : Promise.resolve(null),
      reviewFilter
        ? prisma.review.findMany({
            where: reviewFilter,
            include: { album: { include: { artist: true } } },
            orderBy: { createdAt: "desc" },
            take: MAX_REVIEWS,
          })
        : Promise.resolve([]),
      prisma.dossier.findMany({
        where: { status: "published", locale: "es" },
        include: { album: { include: { artist: true } } },
        orderBy: { id: "asc" },
      }),
      pastFilter
        ? prisma.dailyPick.findMany({
            where: pastFilter,
            include: { album: { include: { artist: true } } },
            orderBy: { date: "desc" },
            take: MAX_RECENT_PICKS,
          })
        : Promise.resolve([]),
    ]);

    if (!profile && reviews.length === 0 && !opts.mood) return null;
    if (catalogo.length === 0) return null;

    const parsedProfile = profile
      ? parseJson<Record<string, unknown>>(profile.answersJson, {})
      : null;

    const returnRitual =
      !opts.regenerated && !opts.mood
        ? await detectReturnRitual(identity, date)
        : null;

    let eleccion: { albumId: string; reason: string };
    try {
      eleccion = await elegirConLlm({
        profile: parsedProfile,
        reviews,
        mood: opts.mood,
        catalogo,
        picksRecientes,
        albumPrevio: opts.albumPrevio
          ? catalogo.find((d) => d.album.id === opts.albumPrevio) ?? null
          : null,
        returnRitual,
      });
    } catch (err) {
      // La IA falló: el oyente nunca cae en la rotación global si tenemos sus
      // gustos. Elegimos por afinidad (géneros, artistas, diario) sin IA.
      if (returnRitual) {
        const recientesIds = new Set(picksRecientes.map((p) => p.albumId));
        const pool = catalogo
          .filter((d) => !recientesIds.has(d.album.id))
          .sort((a, b) => a.album.difficulty - b.album.difficulty);
        const dossier = pool[0] ?? catalogo[0];
        if (!dossier) throw err;
        eleccion = {
          albumId: dossier.album.id,
          reason: fallbackReturnReason(
            returnRitual.absenceDays,
            dossier.album.title,
            dossier.album.artist.name,
          ),
        };
      } else {
        const porGusto = elegirPorGusto({
          profile: parsedProfile,
          reviews,
          catalogo,
          picksRecientes,
        });
        if (!porGusto) throw err;
        eleccion = porGusto;
      }
    }

    const dossier = catalogo.find((d) => d.album.id === eleccion.albumId);
    if (!dossier) {
      throw new Error(`El LLM eligió un albumId fuera del catálogo: ${eleccion.albumId}`);
    }

    let reason = eleccion.reason?.trim().slice(0, 600) || null;
    if (returnRitual && !reason) {
      reason = fallbackReturnReason(
        returnRitual.absenceDays,
        dossier.album.title,
        dossier.album.artist.name,
      );
    }

    await saveTodaysPick(ctx, date, {
      albumId: dossier.album.id,
      reason,
      mood: opts.mood,
      regenerated: opts.regenerated ?? false,
      returnPick: Boolean(returnRitual),
      absenceDays: returnRitual?.absenceDays ?? null,
    });

    return {
      dossier,
      reason,
      mood: opts.mood,
      regenerated: opts.regenerated ?? false,
      returnPick: Boolean(returnRitual),
      absenceDays: returnRitual?.absenceDays ?? null,
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
  returnRitual: ReturnRitual | null;
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
    ? formatPerfil(input.profile)
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

  const regresoTexto = input.returnRitual
    ? `\nREGRESO TRAS AUSENCIA: el usuario vuelve después de ${input.returnRitual.absenceDays} días sin el ritual (último pick: ${input.returnRitual.lastPickDate}). Elige un disco acogedor para reenganchar — prioriza dificultad baja/media si la ausencia fue larga. En "reason" reconoce el regreso con calidez ("te guardé algo", "bienvenido de vuelta"), SIN culpa, SIN mencionar rachas rotas ni gamificación.\n`
    : "";

  const system = `Eres el curador musical de Musicart: cercano, melómano, hablas en español y de "tú".
Tu trabajo: elegir UN disco del catálogo para este usuario hoy, y explicar por qué ese disco, para él/ella, hoy.

Reglas estrictas:
1. Responde SOLO un objeto JSON: {"albumId": "...", "reason": "..."} — sin texto extra.
2. "albumId" debe ser EXACTAMENTE uno de los albumId del catálogo.
3. "reason": 1 a 3 frases en español, cálidas y concretas, citando SOLO señales reales del usuario que aparecen abajo (sus estrellas, sus respuestas, su perfil, su ánimo de hoy). Ej.: "Le diste 5★ a X…", "dijiste que buscas la historia…".
4. Sobre el disco solo puedes mencionar lo que aparece en el catálogo (título, artista, año, duración, etiquetas). PROHIBIDO inventar datos del álbum o del usuario.
5. Evita repetir discos recomendados en días recientes, salvo que no haya alternativa razonable.
6. Si el usuario indicó su ánimo de hoy, dale prioridad como señal.
7. GUSTO ANTE TODO: prioriza sus géneros y artistas favoritos. Un rockero NO debe recibir un disco que choque con su gusto (p. ej. balada romántica) salvo como puente claro y bien justificado en la "reason". Mejor un disco que reconozca como suyo que uno "objetivamente importante" pero ajeno.`;

  const user = `CATÁLOGO DISPONIBLE (elige uno por su albumId):
${catalogoTexto}

PERFIL DEL USUARIO:
${perfilTexto}

SU DIARIO (reseñas recientes, de la más nueva a la más vieja):
${diarioTexto}

ÁNIMO DE HOY: ${input.mood ?? "(no indicado)"}
${regeneracionTexto}${regresoTexto}
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

  if (input.returnRitual) {
    const dossier = input.catalogo.find((d) => d.album.id === parsed.albumId);
    if (dossier && parsed.reason.length < 40) {
      return {
        albumId: parsed.albumId,
        reason: fallbackReturnReason(
          input.returnRitual.absenceDays,
          dossier.album.title,
          dossier.album.artist.name,
        ),
      };
    }
  }

  return { albumId: parsed.albumId, reason: parsed.reason };
}

// ─── Perfil legible para el prompt ───────────────────────────────────────────
// En vez de volcar el JSON crudo, resaltamos lo que define el gusto (géneros y
// artistas) para que el LLM lo pondere bien.

function comoLista(valor: unknown): string[] {
  return Array.isArray(valor)
    ? valor.filter((x): x is string => typeof x === "string")
    : [];
}

function formatPerfil(profile: Record<string, unknown>): string {
  const generos = comoLista(profile.genres);
  const artistas = comoLista(profile.artists);
  const momentos = comoLista(profile.moments);
  const busca = comoLista(profile.seeks);
  const intereses = comoLista(profile.interests);
  const bio = typeof profile.bio === "string" ? profile.bio.trim() : "";
  const tiempo = typeof profile.listenTime === "string" ? profile.listenTime : "";
  const anchors = typeof profile.anchors === "string" ? profile.anchors : "";
  const lineas = [
    generos.length ? `Géneros favoritos: ${generos.join(", ")}` : null,
    artistas.length ? `Artistas que ama: ${artistas.join(", ")}` : null,
    busca.length ? `Busca en un disco: ${busca.join(", ")}` : null,
    momentos.length ? `Escucha: ${momentos.join(", ")}` : null,
    tiempo ? `Tiempo por sesión: ${tiempo}` : null,
    intereses.length ? `Intereses fuera de la música: ${intereses.join(", ")}` : null,
    bio ? `Contexto personal: "${bio}"` : null,
    anchors ? `Otros que lo marcaron: ${anchors}` : null,
  ].filter(Boolean);
  return lineas.length ? lineas.join("\n") : "(perfil vacío)";
}

// ─── Fallback por gusto, sin IA ──────────────────────────────────────────────
// Si la IA no está disponible, elegimos por afinidad con el perfil (géneros,
// artistas favoritos) y el diario (lo que puntuó 4★+). Así el oyente NUNCA cae
// en la rotación global ciega: un rockero recibe rock, no una balada.

type ReviewConAlbum = Prisma.ReviewGetPayload<{
  include: { album: { include: { artist: true } } };
}>;
type PickConAlbum = Prisma.DailyPickGetPayload<{
  include: { album: { include: { artist: true } } };
}>;

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function elegirPorGusto(input: {
  profile: Record<string, unknown> | null;
  reviews: ReviewConAlbum[];
  catalogo: DossierConAlbum[];
  picksRecientes: PickConAlbum[];
}): { albumId: string; reason: string } | null {
  const generos = input.profile ? comoLista(input.profile.genres).map(normalizar) : [];
  const artistas = [
    ...(input.profile ? comoLista(input.profile.artists) : []),
    ...input.reviews.filter((r) => r.rating >= 4).map((r) => r.album.artist.name),
  ].map(normalizar);
  const tagsGustados = new Set<string>();
  for (const r of input.reviews.filter((x) => x.rating >= 4)) {
    for (const t of parseJson<Partial<FactsPayload>>(r.album.factsJson, {}).tags ?? []) {
      tagsGustados.add(normalizar(t));
    }
  }

  if (generos.length === 0 && artistas.length === 0 && tagsGustados.size === 0) {
    return null; // sin señales de gusto → que decida la rotación global
  }

  const recientes = new Set(input.picksRecientes.map((p) => p.albumId));
  const candidatos: { dossier: DossierConAlbum; score: number; motivo: string }[] = [];

  for (const d of input.catalogo) {
    if (recientes.has(d.album.id)) continue;
    const tags = (parseJson<Partial<FactsPayload>>(d.album.factsJson, {}).tags ?? []).map(
      normalizar,
    );
    const artista = normalizar(d.album.artist.name);
    let score = 0;
    let motivo = "";

    if (artistas.some((a) => a && (artista.includes(a) || a.includes(artista)))) {
      score += 6;
      motivo = `${d.album.artist.name} es de los tuyos`;
    }
    if (generos.some((g) => tags.some((t) => t.includes(g) || g.includes(t)))) {
      score += 3;
      if (!motivo) motivo = "encaja con tus géneros";
    }
    const tagMatch = [...tagsGustados].filter((t) => tags.includes(t)).length;
    score += tagMatch;
    if (!motivo && tagMatch > 0) motivo = "conecta con lo que ya te gustó";

    if (score > 0) candidatos.push({ dossier: d, score, motivo });
  }

  if (candidatos.length === 0) return null;
  candidatos.sort((a, b) => b.score - a.score);

  // Entre los mejores, una elección estable por día (varía cada día).
  const top = candidatos.slice(0, Math.max(3, Math.ceil(candidatos.length * 0.3)));
  const dia = Math.floor(Date.now() / 86_400_000);
  const elegido = top[dia % top.length];

  return {
    albumId: elegido.dossier.album.id,
    reason: elegido.motivo ? `Hoy, porque ${elegido.motivo}.` : "Hoy va por tu lado.",
  };
}
