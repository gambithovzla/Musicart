// Motor de recomendación personalizada (Fase 1 + 3.3).
// Con sesión lee/escribe por userId; sin sesión, por deviceId.

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { todayKey, getTodayPick } from "./daily";
import { llm, extractJson, hayClaveIA } from "./dossier/llm";
import {
  type ListenerIdentity,
  pastPicksWhere,
  profileWhere,
  findProfileRecord,
  reviewsWhere,
} from "./identity";
import {
  detectReturnRitual,
  fallbackReturnReason,
  type ReturnRitual,
} from "./return-ritual";
import { parseJson, type FactsPayload } from "./types";
import { formatCuriosities, type CuriosityAnswer } from "./curiosities";
import { proponerDiscoDescubrimiento } from "./discover";
import { curatorVoz } from "./curators";
import { runDossierPipeline } from "./dossier/pipeline";
import { LOVED_THRESHOLD, RATING_MAX, DISLIKED_THRESHOLD } from "./review";
import { hayPresupuestoHoy, registrarGeneracion } from "./budget";

const MAX_REVIEWS = 10;
const MAX_RECENT_PICKS = 14;
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

export type GenerarPickOpts = {
  /** AlbumIds que no pueden volver a salir (p. ej. el disco de hoy antes de rehacer). */
  excluirAlbumIds?: string[];
};

/** AlbumId del pick guardado hoy, si existe. */
export async function albumIdPickDeHoy(
  deviceId: string,
  userId?: string | null,
  tz?: string | null,
): Promise<string | null> {
  const ctx: PickCtx = { deviceId, userId: userId ?? null };
  if (!ctx.deviceId && !ctx.userId) return null;
  const pick = await findTodaysPick(ctx, todayKey(tz));
  return pick?.albumId ?? null;
}

async function etiquetasAlbumes(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const albums = await prisma.album.findMany({
    where: { id: { in: ids } },
    include: { artist: true },
  });
  return albums.map((a) => `"${a.title}" de ${a.artist.name}`);
}

async function propuestaEsAlbumExcluido(
  propuesta: { title: string; artist: string },
  excluir: Set<string>,
): Promise<boolean> {
  if (excluir.size === 0) return false;
  const match = await prisma.album.findFirst({
    where: {
      id: { in: [...excluir] },
      title: { equals: propuesta.title, mode: "insensitive" },
      artist: { name: { equals: propuesta.artist, mode: "insensitive" } },
    },
    select: { id: true },
  });
  return match !== null;
}

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
 * Devuelve el pick del día YA guardado (no genera nada). Con sesión, comparte el
 * mismo disco entre dispositivos. La fabricación del disco fresco vive en
 * `generarPickDelDia` (flujo con pantalla de carga), para no colgar la home.
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
    if (!guardado) return null;
    const dossier = await dossierDelAlbum(guardado.albumId);
    if (!dossier) return null;
    return {
      dossier,
      reason: guardado.reason,
      mood: guardado.mood,
      regenerated: guardado.regenerated,
      returnPick: guardado.returnPick,
      absenceDays: guardado.absenceDays,
    };
  } catch (err) {
    console.error("[recommend] no pude leer el pick guardado:", err);
    return null;
  }
}

/**
 * ¿Podemos fabricarle un disco fresco a este oyente hoy? Sí cuando tiene señales
 * de gusto (perfil o diario) y hay clave de IA. Si no, va la rotación global.
 */
export async function puedeGenerarPickFresco(
  deviceId: string,
  userId?: string | null,
): Promise<boolean> {
  if (!hayClaveIA()) return false;
  const identity: ListenerIdentity = { deviceId, userId: userId ?? null };
  const profileFilter = profileWhere(identity);
  const reviewFilter = reviewsWhere(identity);
  const [perfil, reseñas] = await Promise.all([
    profileFilter ? prisma.profile.count({ where: profileFilter }) : Promise.resolve(0),
    reviewFilter ? prisma.review.count({ where: reviewFilter }) : Promise.resolve(0),
  ]);
  return perfil > 0 || reseñas > 0;
}

/**
 * Borra el disco de hoy de este oyente (para rehacerlo). Devuelve cuántos borró.
 */
export async function borrarPickDeHoy(
  deviceId: string,
  userId?: string | null,
  tz?: string | null,
): Promise<number> {
  const date = todayKey(tz);
  const filtros: Prisma.DailyPickWhereInput[] = [];
  if (userId) filtros.push({ userId, date });
  if (deviceId) filtros.push({ deviceId, date });
  if (filtros.length === 0) return 0;
  const { count } = await prisma.dailyPick.deleteMany({ where: { OR: filtros } });
  return count;
}

/**
 * Caída segura del disco fresco: primero intenta elegir del catálogo publicado
 * (por gusto); si ni eso da, guarda la rotación global como pick. Así, mientras
 * haya un disco en el catálogo, SIEMPRE queda un pick guardado — la home no se
 * queda reintentando en bucle.
 */
async function caerAlCatalogo(
  ctx: PickCtx,
  date: string,
  tz: string | null | undefined,
  mood: string | null,
  lang: string | null,
  excluirAlbumIds?: string[],
): Promise<PickPersonal | null> {
  const delCatalogo = await recomendarYGuardar(
    ctx,
    { mood, lang, excluirAlbumIds, forzarDistinto: (excluirAlbumIds?.length ?? 0) > 0 },
    tz,
  );
  if (delCatalogo) return delCatalogo;

  const rotacion = await getTodayPick(tz);
  if (!rotacion) return null;
  const excluir = new Set(excluirAlbumIds ?? []);
  if (excluir.has(rotacion.album.id)) {
    const otro = await prisma.dossier.findFirst({
      where: {
        status: "published",
        locale: "es",
        albumId: { notIn: [...excluir] },
      },
      include: { album: { include: { artist: true } } },
      orderBy: { id: "asc" },
    });
    if (otro) {
      await saveTodaysPick(ctx, date, {
        albumId: otro.album.id,
        reason: null,
        mood,
        regenerated: true,
      });
      return {
        dossier: otro,
        reason: null,
        mood,
        regenerated: true,
        returnPick: false,
        absenceDays: null,
      };
    }
  }
  await saveTodaysPick(ctx, date, {
    albumId: rotacion.album.id,
    reason: null,
    mood,
    regenerated: false,
  });
  return {
    dossier: rotacion,
    reason: null,
    mood,
    regenerated: false,
    returnPick: false,
    absenceDays: null,
  };
}

/**
 * Fabrica el disco fresco del día: la IA propone un disco real de toda la música
 * (según gusto + diario + ánimo) y el pipeline lo investiga, narra, verifica y
 * publica. Ese disco recién hecho es el del día. Tarda 1-3 min, por eso corre en
 * un flujo aparte (route /api/pick-hoy) con pantalla de carga, no en la home.
 *
 * Red de seguridad en cada paso: si la propuesta o la generación fallan (o el
 * disco no pasa la verificación), cae a elegir del catálogo ya publicado, y de
 * ahí a la rotación global. La app nunca se queda sin disco del día.
 */
export async function generarPickDelDia(
  deviceId: string,
  userId?: string | null,
  tz?: string | null,
  lang?: string | null,
  mood?: string | null,
  opts?: GenerarPickOpts,
): Promise<PickPersonal | null> {
  const ctx: PickCtx = { deviceId, userId: userId ?? null };
  if (!ctx.deviceId && !ctx.userId) return null;
  const date = todayKey(tz);
  const langPick = lang && lang !== "Cualquiera" ? lang : null;
  const excluir = new Set(opts?.excluirAlbumIds ?? []);
  const esRehacer = excluir.size > 0;

  try {
    // Idempotencia: si ya hay disco de hoy (otra pestaña lo hizo), devolverlo.
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

    const identity: ListenerIdentity = { deviceId: ctx.deviceId, userId: ctx.userId };
    const reviewFilter = reviewsWhere(identity);
    const pastFilter = pastPicksWhere(identity, date);

    const [profile, reviews, picksRecientes] = await Promise.all([
      findProfileRecord(identity),
      reviewFilter
        ? prisma.review.findMany({
            where: reviewFilter,
            include: { album: { include: { artist: true } } },
            orderBy: { createdAt: "desc" },
            take: MAX_REVIEWS,
          })
        : Promise.resolve([]),
      pastFilter
        ? prisma.dailyPick.findMany({
            where: pastFilter,
            include: { album: { include: { artist: true } } },
            orderBy: { date: "desc" },
            take: MAX_RECENT_PICKS,
          })
        : Promise.resolve([]),
    ]);

    // Sin señales de gusto no fabricamos (sería un disco al azar): que decida la
    // rotación global. (Normalmente no llegamos aquí: la home filtra antes.)
    if (!profile && reviews.length === 0) {
      return await caerAlCatalogo(ctx, date, tz, mood ?? null, langPick, [...excluir]);
    }

    const parsedProfile = profile
      ? parseJson<Record<string, unknown>>(profile.answersJson, {})
      : null;
    const voz = curatorVoz(
      typeof parsedProfile?.curator === "string" ? parsedProfile.curator : undefined,
    );
    const returnRitual = await detectReturnRitual(identity, date);

    // Tope de gasto: si ya fabricamos el máximo de discos nuevos hoy, no gastamos
    // más IA — el oyente recibe un disco del catálogo existente (igual personal,
    // sin costo de generación nueva). Así abrir la app a testers no se dispara.
    if (!(await hayPresupuestoHoy(date))) {
      console.warn("[recommend] tope de generación diario alcanzado; voy al catálogo.");
      return await caerAlCatalogo(ctx, date, tz, mood ?? null, langPick, [...excluir]);
    }

    // Lo que ya conoce (a evitar al proponer): reseñados + mostrados recientes.
    // Los mal puntuados llevan etiqueta explícita para que el LLM los priorice
    // en su lista de rechazos — la IA no puede volver a proponer lo que no gustó.
    const yaConoce = [
      ...reviews.map((r) => {
        const sufijo =
          r.rating <= DISLIKED_THRESHOLD
            ? ` (puntuado ${r.rating}/${RATING_MAX} — NO volver a proponer nunca)`
            : "";
        return `"${r.album.title}" de ${r.album.artist.name}${sufijo}`;
      }),
      ...picksRecientes.map((p) => `"${p.album.title}" de ${p.album.artist.name}`),
      ...(await etiquetasAlbumes([...excluir])),
    ];

    const patronesTexto = patronesDeEscucha(reviews, picksRecientes);

    let propuesta = await proponerDiscoDescubrimiento({
      perfilTexto: perfilATexto(parsedProfile),
      diarioTexto: diarioATexto(reviews),
      recientesTexto: recientesATexto(picksRecientes),
      yaConoce,
      mood: mood ?? null,
      lang: langPick,
      esRegreso: Boolean(returnRitual),
      diasAusente: returnRitual?.absenceDays ?? null,
      esRehacer,
      voz,
      patronesTexto,
    });

    if (esRehacer && (await propuestaEsAlbumExcluido(propuesta, excluir))) {
      console.warn("[recommend] rehacer repitió propuesta; pido otro disco.");
      propuesta = await proponerDiscoDescubrimiento({
        perfilTexto: perfilATexto(parsedProfile),
        diarioTexto: diarioATexto(reviews),
        recientesTexto: recientesATexto(picksRecientes),
        yaConoce: [...yaConoce, `"${propuesta.title}" de ${propuesta.artist} (rechazado: ya fue hoy)`],
        mood: mood ?? null,
        lang: langPick,
        esRegreso: false,
        diasAusente: null,
        esRehacer: true,
        voz,
        patronesTexto,
      });
      if (await propuestaEsAlbumExcluido(propuesta, excluir)) {
        return await caerAlCatalogo(ctx, date, tz, mood ?? null, langPick, [...excluir]);
      }
    }

    // Red de seguridad: el LLM a veces ignora la lista "yaConoce". Si propuso
    // un disco que ya se le mostró en los últimos días O que ya reseñó, pedimos
    // otro explícitamente. Si el segundo intento también falla, vamos al catálogo.
    const recientesNorm = new Set(
      picksRecientes.map((p) =>
        normalizar(`${p.album.title}|${p.album.artist.name}`)
      )
    );
    const revisadosNorm = new Set(
      reviews.map((r) => normalizar(`${r.album.title}|${r.album.artist.name}`))
    );
    const esPropuestaConflictiva = (p: { title: string; artist: string }) => {
      const k = normalizar(`${p.title}|${p.artist}`);
      return recientesNorm.has(k) || revisadosNorm.has(k);
    };

    if (esPropuestaConflictiva(propuesta)) {
      console.warn(`[recommend] propuesta "${propuesta.title}" era pick reciente o ya reseñada; pidiendo disco distinto.`);
      propuesta = await proponerDiscoDescubrimiento({
        perfilTexto: perfilATexto(parsedProfile),
        diarioTexto: diarioATexto(reviews),
        recientesTexto: recientesATexto(picksRecientes),
        yaConoce: [
          ...yaConoce,
          `"${propuesta.title}" de ${propuesta.artist} (rechazado: ya conocido, PROHIBIDO repetir)`,
        ],
        mood: mood ?? null,
        lang: langPick,
        esRegreso: Boolean(returnRitual),
        diasAusente: returnRitual?.absenceDays ?? null,
        esRehacer: true,
        voz,
        patronesTexto,
      });
      // Verificación del segundo intento: si sigue siendo conflictivo, al catálogo.
      if (esPropuestaConflictiva(propuesta)) {
        console.warn(`[recommend] segunda propuesta "${propuesta.title}" también era conflictiva; voy al catálogo.`);
        return await caerAlCatalogo(ctx, date, tz, mood ?? null, langPick, [...excluir]);
      }
    }

    // El pipeline investiga, narra, verifica y publica (o reutiliza si ya existe).
    const result = await runDossierPipeline(propuesta.title, propuesta.artist, {
      publish: true,
    });

    // Post-pipeline: rechazar si el resultado es el disco a excluir, un pick
    // reciente, o un album que el usuario puntuó bajo — todos son discos que no
    // deben aparecer hoy aunque el pipeline los devuelva como "reused".
    const recientesAlbumIds = new Set(picksRecientes.map((p) => p.album.id));
    const malPuntuadosAlbumIds = new Set(
      reviews.filter((r) => r.rating <= DISLIKED_THRESHOLD).map((r) => r.album.id),
    );
    if (
      excluir.has(result.albumId) ||
      recientesAlbumIds.has(result.albumId) ||
      malPuntuadosAlbumIds.has(result.albumId)
    ) {
      const por = excluir.has(result.albumId)
        ? "mismo disco excluido"
        : recientesAlbumIds.has(result.albumId)
        ? "pick reciente"
        : "disco mal puntuado";
      console.warn(`[recommend] pipeline devolvió ${por}; elijo otro del catálogo.`);
      return await caerAlCatalogo(ctx, date, tz, mood ?? null, langPick, [result.albumId, ...excluir]);
    }

    // Solo consume presupuesto un disco fabricado de verdad; reutilizar es gratis.
    if (!result.reused) await registrarGeneracion(date);

    // Solo mostramos lo verificado. Si quedó en borrador, caemos al catálogo.
    if (result.status !== "published") {
      console.warn(
        `[recommend] "${propuesta.title}" de ${propuesta.artist} no pasó verificación; voy al catálogo.`,
      );
      return await caerAlCatalogo(ctx, date, tz, mood ?? null, langPick, [...excluir]);
    }

    const dossier = await dossierDelAlbum(result.albumId);
    if (!dossier) {
      return await caerAlCatalogo(ctx, date, tz, mood ?? null, langPick, [...excluir]);
    }

    let reason = propuesta.reason?.trim().slice(0, 600) || null;
    if (returnRitual && (!reason || reason.length < 40)) {
      reason = fallbackReturnReason(
        returnRitual.absenceDays,
        dossier.album.title,
        dossier.album.artist.name,
      );
    }

    await saveTodaysPick(ctx, date, {
      albumId: dossier.album.id,
      reason,
      mood: mood ?? null,
      regenerated: esRehacer,
      returnPick: Boolean(returnRitual),
      absenceDays: returnRitual?.absenceDays ?? null,
    });

    return {
      dossier,
      reason,
      mood: mood ?? null,
      regenerated: esRehacer,
      returnPick: Boolean(returnRitual),
      absenceDays: returnRitual?.absenceDays ?? null,
    };
  } catch (err) {
    console.error("[recommend] disco fresco falló, voy al catálogo:", err);
    try {
      return await caerAlCatalogo(ctx, date, tz, mood ?? null, langPick, [...excluir]);
    } catch {
      return null;
    }
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

    // El disco de hoy ya está hecho (muchas veces fabricado a tu medida): no lo
    // tiramos para rehacerlo. Guardamos tu ánimo como señal —cuenta para la
    // recomendación de mañana— y dejamos el disco de hoy en pie.
    await prisma.dailyPick.update({
      where: { id: guardado.id },
      data: { mood },
    });
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
  opts: {
    mood: string | null;
    lang?: string | null;
    albumPrevio?: string;
    regenerated?: boolean;
    excluirAlbumIds?: string[];
    forzarDistinto?: boolean;
  },
  tz?: string | null,
): Promise<PickPersonal | null> {
  try {
    const date = todayKey(tz);
    const identity: ListenerIdentity = {
      deviceId: ctx.deviceId,
      userId: ctx.userId,
    };
    const reviewFilter = reviewsWhere(identity);
    const pastFilter = pastPicksWhere(identity, date);

    const [profile, reviews, catalogo, picksRecientes] = await Promise.all([
      findProfileRecord(identity),
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

    const excluir = new Set(opts.excluirAlbumIds ?? []);
    // Siempre excluir: disco explícitamente descartado + albums mal puntuados (≤4).
    const malPuntuadosIds = new Set(
      reviews.filter((r) => r.rating <= DISLIKED_THRESHOLD).map((r) => r.album.id),
    );
    const recientesIds = new Set(picksRecientes.map((p) => p.album.id));
    const catalogoBase = catalogo.filter(
      (d) => !excluir.has(d.album.id) && !malPuntuadosIds.has(d.album.id),
    );
    // Excluir picks recientes cuando aún quedan alternativas — si el catálogo
    // entero son picks recientes (edge case), los permitimos para no quedar sin disco.
    const sinRecientes = catalogoBase.filter((d) => !recientesIds.has(d.album.id));
    const catalogoFiltrado = sinRecientes.length > 0 ? sinRecientes : catalogoBase;
    if (catalogoFiltrado.length === 0) return null;

    const parsedProfile = profile
      ? parseJson<Record<string, unknown>>(profile.answersJson, {})
      : null;

    const returnRitual =
      !opts.regenerated && !opts.mood
        ? await detectReturnRitual(identity, date)
        : null;

    const patronesTexto = patronesDeEscucha(reviews, picksRecientes);

    let eleccion: { albumId: string; reason: string };
    try {
      eleccion = await elegirConLlm({
        profile: parsedProfile,
        reviews,
        mood: opts.mood,
        lang: opts.lang && opts.lang !== "Cualquiera" ? opts.lang : null,
        catalogo: catalogoFiltrado,
        picksRecientes,
        albumPrevio: opts.albumPrevio
          ? catalogoFiltrado.find((d) => d.album.id === opts.albumPrevio) ?? null
          : null,
        returnRitual,
        forzarDistinto: opts.forzarDistinto ?? false,
        patronesTexto,
      });
    } catch (err) {
      // La IA falló: el oyente nunca cae en la rotación global si tenemos sus
      // gustos. Elegimos por afinidad (géneros, artistas, diario) sin IA.
      if (returnRitual) {
        const recientesIds = new Set(picksRecientes.map((p) => p.albumId));
        const pool = catalogoFiltrado
          .filter((d) => !recientesIds.has(d.album.id))
          .sort((a, b) => a.album.difficulty - b.album.difficulty);
        const dossier = pool[0] ?? catalogoFiltrado[0];
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
          catalogo: catalogoFiltrado,
          picksRecientes,
        });
        if (!porGusto) throw err;
        eleccion = porGusto;
      }
    }

    const dossier = catalogoFiltrado.find((d) => d.album.id === eleccion.albumId);
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
  lang: string | null;  // idioma elegido hoy (null = cualquiera)
  catalogo: DossierConAlbum[];
  picksRecientes: Prisma.DailyPickGetPayload<{
    include: { album: { include: { artist: true } } };
  }>[];
  albumPrevio: DossierConAlbum | null;
  returnRitual: ReturnRitual | null;
  forzarDistinto?: boolean;
  patronesTexto?: string | null;
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

  const perfilTexto = perfilATexto(input.profile);
  const diarioTexto = diarioATexto(input.reviews);
  const recientesTexto = recientesATexto(input.picksRecientes);

  const regeneracionTexto = input.albumPrevio
    ? input.forzarDistinto
      ? `\nREHACER HOY: ya tuvo "${input.albumPrevio.album.title}" de ${input.albumPrevio.album.artist.name} y pidió OTRO disco distinto. PROHIBIDO volver a elegir ese albumId.\n`
      : `\nHOY YA SE LE HABÍA RECOMENDADO: "${input.albumPrevio.album.title}" de ${input.albumPrevio.album.artist.name}, pero acaba de contarnos su ánimo. Puedes mantener ese disco si encaja con el ánimo (escribiendo una razón nueva que lo conecte) o elegir otro que encaje mejor.\n`
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
5. PROHIBIDO elegir un disco que aparezca en la lista "DISCOS RECOMENDADOS EN DÍAS RECIENTES". El catálogo que ves ya los excluye — si ves uno ahí, es un error de lectura.
6. Si el usuario indicó su ánimo de hoy, dale prioridad como señal.
7. GUSTO ANTE TODO: prioriza sus géneros y artistas favoritos. Un rockero NO debe recibir un disco que choque con su gusto (p. ej. balada romántica) salvo como puente claro y bien justificado en la "reason". Mejor un disco que reconozca como suyo que uno "objetivamente importante" pero ajeno.${input.lang ? `\n8. IDIOMA DE HOY: el usuario eligió escuchar en "${input.lang}" hoy. OBLIGATORIO elegir un álbum donde el artista cante principalmente en ese idioma — el idioma del día va por encima del gusto. Si no hay ninguno en el catálogo que encaje, elige el más cercano y menciónalo en la "reason".` : ""}`;

  const user = `CATÁLOGO DISPONIBLE (elige uno por su albumId):
${catalogoTexto}

PERFIL DEL USUARIO:
${perfilTexto}
${input.patronesTexto ? `\n${input.patronesTexto}\n` : ""}
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
  const spotifyArtistas = comoLista(profile.spotifyArtists);
  const spotifyGeneros = comoLista(profile.spotifyGenres);
  const spotifyCanciones = comoLista(profile.spotifyTracks);
  const generos = comoLista(profile.genres);
  const artistas = comoLista(profile.artists);
  const idiomas = comoLista(profile.languages);
  const momentos = comoLista(profile.moments);
  const busca = comoLista(profile.seeks);
  const intereses = comoLista(profile.interests);
  const bio = typeof profile.bio === "string" ? profile.bio.trim() : "";
  const tiempo = typeof profile.listenTime === "string" ? profile.listenTime : "";
  const anchors = typeof profile.anchors === "string" ? profile.anchors : "";
  const texto = (k: string) => (typeof profile[k] === "string" ? (profile[k] as string).trim() : "");
  const discoMarca = texto("markedAlbum");
  const discoMarcaArtista = texto("markedArtist");
  const cancionFav = texto("favoriteSong");
  const cancionFavArtista = texto("favoriteSongArtist");
  const curiosities = Array.isArray(profile.curiosities)
    ? formatCuriosities(profile.curiosities as CuriosityAnswer[])
    : "";
  const lineas = [
    generos.length ? `Géneros favoritos: ${generos.join(", ")}` : null,
    artistas.length ? `Artistas que ama: ${artistas.join(", ")}` : null,
    spotifyArtistas.length
      ? `Top en Spotify (últimos meses): ${spotifyArtistas.slice(0, 15).join(", ")}`
      : null,
    spotifyGeneros.length
      ? `Géneros que escucha en Spotify: ${spotifyGeneros.join(", ")}`
      : null,
    spotifyCanciones.length
      ? `Canciones top en Spotify: ${spotifyCanciones.slice(0, 8).join("; ")}`
      : null,
    discoMarca
      ? `Un disco que lo marcó: "${discoMarca}"${discoMarcaArtista ? ` de ${discoMarcaArtista}` : ""}`
      : null,
    cancionFav
      ? `Su canción favorita: "${cancionFav}"${cancionFavArtista ? ` de ${cancionFavArtista}` : ""}`
      : null,
    idiomas.length ? `Idiomas en los que disfruta música: ${idiomas.join(", ")}` : null,
    busca.length ? `Busca en un disco: ${busca.join(", ")}` : null,
    momentos.length ? `Escucha: ${momentos.join(", ")}` : null,
    tiempo ? `Tiempo por sesión: ${tiempo}` : null,
    intereses.length ? `Intereses fuera de la música: ${intereses.join(", ")}` : null,
    bio ? `Contexto personal: "${bio}"` : null,
    anchors ? `Otros que lo marcaron: ${anchors}` : null,
    curiosities ? `Lo que me ha contado (preguntas del día):\n${curiosities}` : null,
  ].filter(Boolean);
  return lineas.length ? lineas.join("\n") : "(perfil vacío)";
}

// Bloques de texto reutilizables (los usan el selector de catálogo y el
// proponedor de disco fresco) para que el prompt cite solo señales reales.

function perfilATexto(profile: Record<string, unknown> | null): string {
  return profile ? formatPerfil(profile) : "(sin perfil todavía)";
}

function diarioATexto(reviews: ReviewConAlbum[]): string {
  if (reviews.length === 0) return "(aún no ha reseñado ningún disco)";
  return reviews
    .map((r) => {
      const respuestas = Object.entries(
        parseJson<Record<string, string>>(r.answersJson, {}),
      )
        .filter(([, v]) => v.trim())
        .map(([q, v]) => `    · ${q} → "${v.slice(0, 140)}"`)
        .join("\n");
      return (
        `- "${r.album.title}" de ${r.album.artist.name}: ${r.rating}/${RATING_MAX}` +
        (respuestas ? `\n${respuestas}` : "")
      );
    })
    .join("\n");
}

function recientesATexto(picks: PickConAlbum[]): string {
  if (picks.length === 0) return "(ninguno)";
  return picks
    .map((p) => `- ${p.date}: "${p.album.title}" de ${p.album.artist.name}`)
    .join("\n");
}

// ─── Patrones de escucha ─────────────────────────────────────────────────────
// Detecta correlaciones mood→género, géneros en racha y estación del año,
// usando datos ya cargados (reviews + picks). Sin queries extra.

function patronesDeEscucha(
  reviews: ReviewConAlbum[],
  picks: PickConAlbum[],
): string | null {
  const lineas: string[] = [];

  // Géneros/tags que el usuario puntúa alto de forma consistente
  const tagsAmados = new Map<string, number>();
  for (const r of reviews.filter((r) => r.rating >= LOVED_THRESHOLD)) {
    const tags = parseJson<Partial<FactsPayload>>(r.album.factsJson, {}).tags ?? [];
    for (const tag of tags.slice(0, 6)) {
      const t = normalizar(tag);
      tagsAmados.set(t, (tagsAmados.get(t) ?? 0) + 1);
    }
  }
  const topAmados = [...tagsAmados.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t]) => t);
  if (topAmados.length > 0) {
    lineas.push(`- Lo que más le ha gustado (rating ≥${LOVED_THRESHOLD}): ${topAmados.join(", ")}`);
  }

  // Correlación mood → géneros (de los picks recientes que registraron ánimo)
  const moodGenres = new Map<string, Set<string>>();
  for (const pick of picks) {
    if (!pick.mood) continue;
    const tags = parseJson<Partial<FactsPayload>>(pick.album.factsJson, {}).tags ?? [];
    if (!moodGenres.has(pick.mood)) moodGenres.set(pick.mood, new Set());
    for (const t of tags.slice(0, 3)) moodGenres.get(pick.mood)!.add(normalizar(t));
  }
  for (const [mood, tagSet] of moodGenres.entries()) {
    const top = [...tagSet].slice(0, 3);
    if (top.length > 0) {
      lineas.push(`- Con ánimo "${mood}" ha escuchado: ${top.join(", ")}`);
    }
  }

  // Estación del año actual
  const mes = new Date().getMonth();
  const estaciones = ["invierno","invierno","primavera","primavera","primavera","verano","verano","verano","otoño","otoño","otoño","invierno"];
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  lineas.push(`- Ahora es ${meses[mes]} (${estaciones[mes]})`);

  // Solo tiene sentido si hay patrones reales, no solo la estación
  if (lineas.length <= 1) return null;

  return `PATRONES DE ESCUCHA (de su historial real):\n${lineas.join("\n")}`;
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
  const generos = [
    ...(input.profile ? comoLista(input.profile.genres) : []),
    ...(input.profile ? comoLista(input.profile.spotifyGenres) : []),
  ].map(normalizar);
  const artistas = [
    ...(input.profile ? comoLista(input.profile.artists) : []),
    ...(input.profile ? comoLista(input.profile.spotifyArtists) : []),
    ...input.reviews.filter((r) => r.rating >= LOVED_THRESHOLD).map((r) => r.album.artist.name),
  ].map(normalizar);
  const tagsGustados = new Set<string>();
  for (const r of input.reviews.filter((x) => x.rating >= LOVED_THRESHOLD)) {
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
