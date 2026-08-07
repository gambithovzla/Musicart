// Motor de recomendación personalizada (Fase 1 + 3.3).
// Con sesión lee/escribe por userId; sin sesión, por deviceId.

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { todayKey } from "./daily";
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
import {
  proponerDiscoDescubrimiento,
  discoCumplePedido,
  type DiscoPropuesto,
} from "./discover";
import { cargarNotasTexto } from "./listener-notes";
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
  /** Pedido del oyente en lenguaje natural para el disco de hoy ("rock con
   *  energía", "algo tipo Linkin Park"). Lo escribe en el gate del día (o el
   *  admin al rehacer) y manda sobre el gusto al proponer. */
  peticion?: string | null;
  /** Salta el tope de gasto diario (solo el admin/dueño): para él la app SIEMPRE
   *  fabrica fresco — el tope existe para no dispararse con testers, no para el
   *  dueño, a quien repetirle un disco es justo lo que queremos evitar. */
  omitirPresupuesto?: boolean;
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

/** Una obra musical para comparar repeticiones (independiente del id de fila). */
type Obra = { title: string; artist: string };

/** Trae título + artista de varios álbumes por id (para comparar repeticiones). */
async function albumesObras(ids: string[]): Promise<Obra[]> {
  if (ids.length === 0) return [];
  const albums = await prisma.album.findMany({
    where: { id: { in: ids } },
    include: { artist: true },
  });
  return albums.map((a) => ({ title: a.title, artist: a.artist.name }));
}

/** ¿La propuesta es la MISMA obra que alguno de los discos a evitar? */
function esObraConocida(propuesta: Obra, conocidas: Obra[]): boolean {
  return conocidas.some((o) => mismaObra(propuesta, o));
}

/**
 * Memoria COMPLETA del oyente: TODO disco que alguna vez se le recomendó (todo
 * el historial de DailyPick, no solo las últimas semanas) y TODO disco que
 * reseñó. Es la lista definitiva de "no me lo repitas" — ayer, hace un mes o
 * hace un año. Devuelve ids y obras (para comparar por contenido) y los mal
 * puntuados aparte. Las obras vienen con los picks más recientes primero.
 */
type MemoriaDiscos = {
  vistosIds: Set<string>;
  vistosObras: Obra[];
  dislikedIds: Set<string>;
};

async function cargarMemoriaDiscos(
  identity: ListenerIdentity,
  date: string,
): Promise<MemoriaDiscos> {
  const pastFilter = pastPicksWhere(identity, date);
  const reviewFilter = reviewsWhere(identity);
  const [picks, reseñas] = await Promise.all([
    pastFilter
      ? prisma.dailyPick.findMany({
          where: pastFilter,
          orderBy: { date: "desc" },
          select: {
            album: {
              select: { id: true, title: true, artist: { select: { name: true } } },
            },
          },
        })
      : Promise.resolve([]),
    reviewFilter
      ? prisma.review.findMany({
          where: reviewFilter,
          orderBy: { createdAt: "desc" },
          select: {
            rating: true,
            album: {
              select: { id: true, title: true, artist: { select: { name: true } } },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const vistosIds = new Set<string>();
  const vistosObras: Obra[] = [];
  const dislikedIds = new Set<string>();
  const recordar = (album: { id: string; title: string; artist: { name: string } }) => {
    if (vistosIds.has(album.id)) return;
    vistosIds.add(album.id);
    vistosObras.push({ title: album.title, artist: album.artist.name });
  };
  // Picks primero (más recientes primero) para que el recorte del prompt
  // priorice lo más nuevo; luego las reseñas.
  for (const p of picks) recordar(p.album);
  for (const r of reseñas) {
    recordar(r.album);
    if (r.rating <= DISLIKED_THRESHOLD) dislikedIds.add(r.album.id);
  }
  return { vistosIds, vistosObras, dislikedIds };
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
  peticion?: string | null,
): Promise<PickPersonal | null> {
  const delCatalogo = await recomendarYGuardar(
    ctx,
    { mood, lang, excluirAlbumIds, peticion, forzarDistinto: (excluirAlbumIds?.length ?? 0) > 0 },
    tz,
  );
  if (delCatalogo) return delCatalogo;

  // Última red: rotación global PERO consciente de la memoria del oyente —
  // nunca le re-sirve un disco que ya vio (y lo deja guardado para el futuro).
  return rotacionParaOyente(ctx, date, mood, excluirAlbumIds);
}

/**
 * Rotación global consciente de la memoria del oyente. Es la diferencia clave
 * con `getTodayPick` (rotación ciega): elige un disco publicado que el oyente
 * NO haya visto nunca, lo GUARDA como su pick de hoy y lo devuelve. Así:
 *   1. No se le repite un disco ya mostrado (ni por rotación ni por catálogo).
 *   2. Queda registrado en su historial, para que la dedup lo recuerde mañana
 *      — el hueco que hacía que un disco "solo visto por rotación" volviera a
 *      proponerse como si fuera nuevo.
 * Si ya vio TODO el catálogo, cae a la rotación determinista (mejor mostrar
 * algo conocido que dejar la home sin disco).
 */
async function rotacionParaOyente(
  ctx: PickCtx,
  date: string,
  mood: string | null,
  excluirAlbumIds?: string[],
): Promise<PickPersonal | null> {
  const identity: ListenerIdentity = { deviceId: ctx.deviceId, userId: ctx.userId };
  const [dossiers, memoria] = await Promise.all([
    prisma.dossier.findMany({
      where: { status: "published", locale: "es" },
      include: { album: { include: { artist: true } } },
      orderBy: { id: "asc" },
    }),
    cargarMemoriaDiscos(identity, date),
  ]);
  if (dossiers.length === 0) return null;

  const excluir = new Set(excluirAlbumIds ?? []);
  const noVisto = (d: DossierConAlbum): boolean => {
    const obra: Obra = { title: d.album.title, artist: d.album.artist.name };
    return (
      !excluir.has(d.album.id) &&
      !memoria.vistosIds.has(d.album.id) &&
      !memoria.vistosObras.some((o) => mismaObra(obra, o))
    );
  };

  const noVistos = dossiers.filter(noVisto);
  // Preferimos lo no visto. Si ya vio TODO, no rotamos a ciegas sobre el catálogo
  // (ahí volvería a tocarle un disco recién mostrado): nos quedamos con el tercio
  // que lleva MÁS TIEMPO sin aparecer y elegimos determinista dentro de ese
  // grupo. Así, por agotamiento, nunca le re-servimos el disco de ayer.
  let pool: DossierConAlbum[];
  if (noVistos.length > 0) {
    pool = noVistos;
  } else {
    const disponibles = dossiers.filter((d) => !excluir.has(d.album.id));
    const rango = rangoPorRecencia(memoria.vistosObras);
    pool = [...disponibles]
      .sort(
        (a, b) =>
          rango({ title: b.album.title, artist: b.album.artist.name }) -
          rango({ title: a.album.title, artist: a.album.artist.name }),
      )
      .slice(0, Math.max(1, Math.ceil(disponibles.length * 0.3)));
  }
  if (pool.length === 0) return null;

  // Elección determinista por día (estable dentro del día, varía entre días).
  const [y, m, dd] = date.split("-").map(Number);
  const dias = Math.floor(Date.UTC(y, m - 1, dd) / 86_400_000);
  const elegido = pool[dias % pool.length];

  await saveTodaysPick(ctx, date, {
    albumId: elegido.album.id,
    reason: null,
    mood,
    regenerated: (excluirAlbumIds?.length ?? 0) > 0,
  });
  return {
    dossier: elegido,
    reason: null,
    mood,
    regenerated: (excluirAlbumIds?.length ?? 0) > 0,
    returnPick: false,
    absenceDays: null,
  };
}

/**
 * Pick de rotación para la home cuando el oyente NO puede fabricar disco fresco
 * (sin IA o sin señales todavía): elige un disco que no haya visto y lo GUARDA,
 * en vez de mostrar la rotación ciega sin registrarla. Registrar lo mostrado es
 * lo que evita que ese mismo disco vuelva a "salir como nuevo" más adelante.
 */
export async function getRotacionPickGuardada(
  deviceId: string,
  userId?: string | null,
  tz?: string | null,
): Promise<PickPersonal | null> {
  const ctx: PickCtx = { deviceId, userId: userId ?? null };
  if (!ctx.deviceId && !ctx.userId) return null;
  try {
    const date = todayKey(tz);
    // Idempotencia: si ya hay pick de hoy (lo guardó otra pestaña), úsalo.
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
    return await rotacionParaOyente(ctx, date, null, []);
  } catch (err) {
    console.error("[recommend] rotación para la home falló:", err);
    return null;
  }
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
  const peticion = opts?.peticion?.trim() || null;

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

    const [profile, reviews, picksRecientes, memoria, notasTexto] = await Promise.all([
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
      // Memoria COMPLETA (todo el historial), para no repetir NUNCA un disco ya visto.
      cargarMemoriaDiscos(identity, date),
      // Memoria personal: lo que el oyente le ha contado al curador (Fase interacción).
      cargarNotasTexto(identity),
    ]);

    // Sin señales de gusto no fabricamos (sería un disco al azar): que decida la
    // rotación global. (Normalmente no llegamos aquí: la home filtra antes.)
    if (!profile && reviews.length === 0) {
      return await caerAlCatalogo(ctx, date, tz, mood ?? null, langPick, [...excluir], peticion);
    }

    const parsedProfile = profile
      ? parseJson<Record<string, unknown>>(profile.answersJson, {})
      : null;
    // El perfil para el prompt incluye su memoria personal (lo que nos contó),
    // así el disco del día se afina con cada cosa que comparte.
    const perfilTexto = [perfilATexto(parsedProfile), notasTexto]
      .filter(Boolean)
      .join("\n\n");
    const voz = curatorVoz(
      typeof parsedProfile?.curator === "string" ? parsedProfile.curator : undefined,
    );
    const returnRitual = await detectReturnRitual(identity, date);

    // Tope de gasto: si ya fabricamos el máximo de discos nuevos hoy, no gastamos
    // más IA — el oyente recibe un disco del catálogo existente (igual personal,
    // sin costo de generación nueva). Así abrir la app a testers no se dispara.
    // El admin/dueño está EXENTO: a él nunca le caemos al catálogo por tope (sería
    // repetirle un disco, justo lo que evitamos).
    if (!opts?.omitirPresupuesto && !(await hayPresupuestoHoy(date))) {
      console.warn("[recommend] tope de generación diario alcanzado; voy al catálogo.");
      return await caerAlCatalogo(ctx, date, tz, mood ?? null, langPick, [...excluir], peticion);
    }

    // Obras a evitar, comparables por contenido (artista + núcleo del título),
    // no por id ni texto exacto: así reconocemos el mismo disco aunque las
    // fuentes lo guarden con un título o un id distinto. Usamos la memoria
    // COMPLETA (todo el historial), no solo las últimas semanas: un disco de
    // hace un mes tampoco debe repetirse.
    const excluidasObras = await albumesObras([...excluir]);
    const obrasAEvitar: Obra[] = [...memoria.vistosObras, ...excluidasObras];

    // Lo que ya conoce (a evitar al proponer): TODO el historial. Las reseñas
    // recientes mal puntuadas llevan etiqueta explícita para que el LLM las
    // priorice en su lista de rechazos. El resto del historial va en líneas
    // simples; recortamos a un máximo razonable para no inflar el prompt — la
    // barrera dura (obrasAEvitar) cubre TODO, esta lista es solo una pista.
    const MAX_YA_CONOCE = 120;
    const yaConoce: string[] = [];
    const vistosEnLista = new Set<string>();
    const agregar = (title: string, artist: string, sufijo = "") => {
      const clave = normalizar(`${title}|${artist}`);
      if (vistosEnLista.has(clave)) return;
      vistosEnLista.add(clave);
      yaConoce.push(`"${title}" de ${artist}${sufijo}`);
    };
    for (const r of reviews) {
      const sufijo =
        r.rating <= DISLIKED_THRESHOLD
          ? ` (puntuado ${r.rating}/${RATING_MAX} — NO volver a proponer nunca)`
          : "";
      agregar(r.album.title, r.album.artist.name, sufijo);
    }
    for (const o of [...memoria.vistosObras, ...excluidasObras]) {
      if (yaConoce.length >= MAX_YA_CONOCE) break;
      agregar(o.title, o.artist);
    }

    const patronesTexto = patronesDeEscucha(reviews, picksRecientes);
    // Artistas de los picks recientes: para no repetir el mismo artista (variedad).
    const artistasRecientes = [
      ...new Set(picksRecientes.map((p) => p.album.artist.name)),
    ];

    // Argumentos comunes del proponedor; lo único que cambia entre intentos es la
    // lista de rechazos acumulada (para empujar al LLM lejos de lo ya intentado).
    const argsPropuesta = (extraYaConoce: string[]) => ({
      perfilTexto,
      diarioTexto: diarioATexto(reviews),
      recientesTexto: recientesATexto(picksRecientes),
      yaConoce: [...yaConoce, ...extraYaConoce],
      mood: mood ?? null,
      lang: langPick,
      esRegreso: Boolean(returnRitual),
      diasAusente: returnRitual?.absenceDays ?? null,
      // Tras el primer rechazo tratamos cada intento como "rehacer": activa el
      // texto que le pide al LLM algo DISTINTO de forma explícita.
      esRehacer: esRehacer || extraYaConoce.length > 0,
      voz,
      patronesTexto,
      peticion,
      artistasRecientes,
    });

    // Discos que el LLM ya propuso (o que el pipeline resolvió) y rechazamos en
    // ESTA fabricación. Se acumulan intento a intento para empujar al proponedor
    // hacia un disco genuinamente nuevo. Para un oyente con historial rico —o el
    // dueño, cuyo catálogo publicado ES básicamente su propio historial— un solo
    // reintento no basta: el LLM gravita a los mismos discos canónicos y, al
    // rendirse pronto, caíamos al catálogo… que para él es justo una repetición.
    const rechazados: string[] = [];
    const rechazar = (p: Obra, motivo: string) => {
      rechazados.push(`"${p.title}" de ${p.artist} (rechazado: ${motivo} — PROHIBIDO repetir)`);
    };

    // Una propuesta es conflictiva si es una obra ya vista (memoria completa) o,
    // al rehacer, uno de los discos excluidos hoy.
    const esConflictiva = (p: Obra) =>
      esObraConocida(p, obrasAEvitar) || (esRehacer && esObraConocida(p, excluidasObras));

    // Consigue una PROPUESTA que pase los filtros baratos (no repetida + cumple el
    // pedido) en pocas llamadas del proponedor (texto, baratas). Así el pipeline
    // (caro) solo corre sobre un disco que YA sabemos nuevo y acorde al pedido.
    const MAX_PROPUESTAS = 8;
    const conseguirPropuesta = async (): Promise<DiscoPropuesto | null> => {
      for (let i = 0; i < MAX_PROPUESTAS; i++) {
        const p = await proponerDiscoDescubrimiento(argsPropuesta(rechazados));
        if (esConflictiva(p)) {
          console.warn(
            `[recommend] propuesta "${p.title}" de ${p.artist} ya conocida; pido otra (${i + 1}/${MAX_PROPUESTAS}).`,
          );
          rechazar(p, "ya conocido");
          continue;
        }
        if (peticion) {
          const v = await discoCumplePedido({
            peticion,
            title: p.title,
            artist: p.artist,
            lang: langPick,
          });
          if (!v.cumple) {
            console.warn(
              `[recommend] "${p.title}" de ${p.artist} NO cumple el pedido «${peticion}» (${v.motivo}); pido otra.`,
            );
            rechazar(p, `no cumple el pedido «${peticion}» — ${v.motivo}`);
            continue;
          }
        }
        return p;
      }
      return null;
    };

    // Varias pasadas COMPLETAS (propuesta → pipeline → verificación post-pipeline).
    // Solo si TODAS fallan caemos al catálogo, que para el oyente principal sería
    // una repetición. Acotamos las pasadas de pipeline (son caras) pero damos
    // margen para encontrar de verdad un disco fresco antes de rendirnos: con
    // millones de discos en el mundo y solo unas decenas que evitar, rendirse y
    // repetir es el peor resultado posible.
    const MAX_PIPELINE = 4;
    for (let intento = 0; intento < MAX_PIPELINE; intento++) {
      const propuesta = await conseguirPropuesta();
      // El proponedor solo nombró discos ya vistos en esta ronda. NO nos rendimos:
      // la lista de rechazos (`rechazados`) creció, así que el siguiente intento
      // empuja al proponedor MÁS LEJOS de sus favoritos canónicos (que son justo
      // los que el oyente ya conoce). Rendirse aquí = caer al catálogo = repetir.
      if (!propuesta) continue;

      // El pipeline investiga, narra, verifica y publica (o reutiliza si ya existe).
      const result = await runDossierPipeline(propuesta.title, propuesta.artist, {
        publish: true,
      });

      // Post-pipeline: comparamos por id Y por obra. El pipeline resuelve título y
      // artista contra MusicBrainz/iTunes y puede caer en (a) un disco que ya vio
      // —aunque venga como "reused" con otro id/título—, (b) una obra DISTINTA a la
      // propuesta (la "reason" hablaría de otro disco), o (c) un borrador que no
      // pasó verificación. En cualquiera de esos casos NO lo servimos: anotamos el
      // rechazo y volvemos a intentar fabricar algo nuevo.
      const resultAlbum = await prisma.album.findUnique({
        where: { id: result.albumId },
        include: { artist: true },
      });
      const resultObra: Obra | null = resultAlbum
        ? { title: resultAlbum.title, artist: resultAlbum.artist.name }
        : null;
      const obraRepetida = resultObra ? esObraConocida(resultObra, obrasAEvitar) : false;
      const propuestaObra: Obra = { title: propuesta.title, artist: propuesta.artist };
      const resuelveOtraObra = !resultObra || !mismaObra(resultObra, propuestaObra);

      if (
        excluir.has(result.albumId) ||
        memoria.vistosIds.has(result.albumId) ||
        obraRepetida ||
        resuelveOtraObra ||
        result.status !== "published"
      ) {
        const por = excluir.has(result.albumId)
          ? "mismo disco excluido"
          : memoria.vistosIds.has(result.albumId)
          ? "disco ya visto en el historial"
          : obraRepetida
          ? "misma obra ya vista (otro id/título)"
          : resuelveOtraObra
          ? `disco distinto al propuesto ("${propuesta.title}" de ${propuesta.artist} → "${resultObra?.title ?? "?"}" de ${resultObra?.artist ?? "?"})`
          : "no pasó verificación (quedó en borrador)";
        console.warn(
          `[recommend] intento ${intento + 1}/${MAX_PIPELINE}: pipeline devolvió ${por}; reintento.`,
        );
        // Que ni la propuesta ni el disco resuelto vuelvan a salir en próximos intentos.
        rechazar(propuestaObra, por);
        if (resultObra) rechazar(resultObra, por);
        continue;
      }

      // Solo consume presupuesto un disco fabricado de verdad; reutilizar es gratis.
      if (!result.reused) await registrarGeneracion(date);

      const dossier = await dossierDelAlbum(result.albumId);
      if (!dossier) break; // raro: publicado pero sin dossier → catálogo

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
    }

    // Agotamos los intentos de fabricar algo nuevo: última red, el catálogo.
    console.warn(
      "[recommend] no logré fabricar un disco nuevo tras varios intentos; voy al catálogo.",
    );
    return await caerAlCatalogo(ctx, date, tz, mood ?? null, langPick, [...excluir], peticion);
  } catch (err) {
    console.error("[recommend] disco fresco falló, voy al catálogo:", err);
    try {
      return await caerAlCatalogo(ctx, date, tz, mood ?? null, langPick, [...excluir], peticion);
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
    /** Lo que el oyente pidió hoy en lenguaje natural. Aunque el catálogo sea
     *  cerrado, elegimos el disco que más se acerque al pedido. */
    peticion?: string | null;
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

    const [profile, reviews, catalogo, picksRecientes, memoria, notasTexto] = await Promise.all([
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
      // Memoria COMPLETA (todo el historial), para no repetir NUNCA un disco visto.
      cargarMemoriaDiscos(identity, date),
      // Memoria personal del oyente (lo que nos contó), para afinar la elección.
      cargarNotasTexto(identity),
    ]);

    if (!profile && reviews.length === 0 && !opts.mood) return null;

    const excluir = new Set(opts.excluirAlbumIds ?? []);
    const excluidasObras = await albumesObras([...excluir]);
    // Vetado = descartado explícito, o YA visto alguna vez (todo el historial),
    // comparando por id Y por obra (mismo disco con otro id/título).
    const obraVetada = (d: DossierConAlbum): boolean => {
      const obra: Obra = { title: d.album.title, artist: d.album.artist.name };
      return (
        memoria.vistosObras.some((o) => mismaObra(obra, o)) ||
        excluidasObras.some((o) => mismaObra(obra, o))
      );
    };
    const noVisto = (d: DossierConAlbum): boolean =>
      !excluir.has(d.album.id) && !memoria.vistosIds.has(d.album.id) && !obraVetada(d);

    // Preferimos discos NUNCA vistos. Si ya recorrió todo el catálogo publicado
    // (edge case), relajamos: permitimos repetir lo ya visto pero seguimos
    // excluyendo lo descartado y lo que puntuó bajo, para no quedar sin disco.
    // Incluso al relajar, NUNCA re-servimos la MISMA obra que acabamos de excluir
    // (el disco de hoy/ayer que dispara el rehacer) ni aunque venga con otro id:
    // ese es justo el "me lo repite cada vez" que queremos cortar.
    const esObraExcluida = (d: DossierConAlbum): boolean => {
      const obra: Obra = { title: d.album.title, artist: d.album.artist.name };
      return excluidasObras.some((o) => mismaObra(obra, o));
    };
    const sinVistos = catalogo.filter(noVisto);

    // Catálogo agotado: el oyente ya vio todo. En vez de dar rienda suelta al LLM
    // (que siempre elige su "mejor match" = el mismo disco en bucle), aplicamos dos
    // capas de protección:
    //   1. Hard: preferimos álbumes que NO aparezcan entre los más recientes de
    //      memoria.vistosObras (que viene ordenado del más reciente al más antiguo).
    //      Así forzamos que salga algo que lleve tiempo sin aparecer.
    //   2. Soft: pasamos el historial al LLM como lista "PROHIBIDO repetir" para que
    //      elija el que lleve MÁS tiempo sin aparecer si el hard tier está vacío.
    const catalogoBase = catalogo.filter(
      (d) =>
        !excluir.has(d.album.id) &&
        !memoria.dislikedIds.has(d.album.id) &&
        !esObraExcluida(d),
    );

    // "Recientes" = los primeros MAX_RECIENTES de vistosObras (más nuevos primero).
    // Excluimos hasta el 70% del historial (tope: 90), asegurándonos de dejar al
    // menos 1 álbum disponible en el tier de recencia para no vaciar el pool.
    const MAX_RECIENTES = Math.min(
      90,
      Math.max(0, Math.floor(memoria.vistosObras.length * 0.7) - 1),
    );
    const recientesKeys = new Set(
      memoria.vistosObras
        .slice(0, MAX_RECIENTES)
        .map((o) => `${normalizar(o.artist)}||${nucleoTitulo(o.title)}`),
    );
    const noMuyReciente = (d: DossierConAlbum): boolean => {
      const k = `${normalizar(d.album.artist.name)}||${nucleoTitulo(d.album.title)}`;
      return !recientesKeys.has(k);
    };
    const catalogoConRecencia = catalogoBase.filter(noMuyReciente);

    // Última red cuando ya vio TODO el catálogo y hasta el filtro de recencia se
    // quedó vacío (catálogo pequeño, como el del dueño): en vez de reabrir TODO
    // el catálogo —donde volvería a colarse un disco recién mostrado, el clásico
    // "me repite el mismo cada vez"— nos quedamos con el tercio que lleva MÁS
    // TIEMPO sin aparecer. Así, por agotamiento, sale lo más viejo, nunca lo de
    // ayer.
    const rango = rangoPorRecencia(memoria.vistosObras);
    const colaPorRecencia = [...catalogoBase]
      .sort(
        (a, b) =>
          rango({ title: b.album.title, artist: b.album.artist.name }) -
          rango({ title: a.album.title, artist: a.album.artist.name }),
      )
      .slice(0, Math.max(1, Math.ceil(catalogoBase.length * 0.3)));

    const catalogoFiltrado =
      sinVistos.length > 0
        ? sinVistos
        : catalogoConRecencia.length > 0
        ? catalogoConRecencia
        : colaPorRecencia;

    if (sinVistos.length === 0) {
      console.warn(
        `[recommend] catálogo agotado (${catalogo.length} álbumes, todos vistos); ` +
          `usando ${catalogoConRecencia.length > 0 ? `recencia (${catalogoConRecencia.length} no recientes)` : "catálogo relajado completo"}.`,
      );
    }

    if (catalogoFiltrado.length === 0) return null;

    // Cuando el catálogo está agotado, pasamos el historial al LLM para que
    // evite el bucle "mismo disco siempre" incluso si todos ya se mostraron.
    const MAX_YA_VISTOS_LLM = 80;
    const yaVistosHistorial: string[] | undefined =
      sinVistos.length === 0
        ? memoria.vistosObras
            .slice(0, MAX_YA_VISTOS_LLM)
            .map((o) => `"${o.title}" de ${o.artist}`)
        : undefined;

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
        peticion: opts.peticion ?? null,
        yaVistosHistorial,
        notasTexto,
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
  peticion?: string | null;
  /** Historial completo de discos ya vistos/reseñados: se usa cuando el catálogo
   *  está agotado (todo visto) para que el LLM elija el que lleva MÁS TIEMPO sin
   *  aparecer, no el que mejor encaja por gusto (evita el bucle del mismo disco). */
  yaVistosHistorial?: string[];
  /** Memoria personal del oyente (lo que le contó al curador). */
  notasTexto?: string | null;
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

  const perfilTexto = [perfilATexto(input.profile), input.notasTexto]
    .filter(Boolean)
    .join("\n\n");
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

  // Lo que el oyente pidió hoy (texto libre). El catálogo es cerrado, así que no
  // siempre se puede cumplir al pie de la letra: elegimos el disco que MÁS se
  // acerque. Si menciona discos como referencia de un sentimiento, NO elegimos
  // ese mismo disco — buscamos uno que comparta ese espíritu.
  const peticionTexto = input.peticion?.trim()
    ? `\nLO QUE EL OYENTE PIDIÓ HOY (máxima prioridad): «${input.peticion.trim()}». Elige del catálogo el disco que MÁS se acerque a ese pedido (género, idioma, estilo, energía o escena). Si menciona discos o artistas como referencia de cómo quiere SENTIRSE, NO elijas ese mismo disco: busca otro que comparta ese espíritu. Si nada encaja bien, elige lo más cercano y dilo con honestidad en la "reason".\n`
    : "";

  // Cuando el catálogo está agotado (el oyente ya vio todo) y el LLM recibe una
  // lista de discos ya vistos, se le pide que evite los más recientes y prefiera
  // el que lleva más tiempo sin aparecer. Así evitamos el bucle del mismo disco.
  const yaVistosTexto =
    input.yaVistosHistorial && input.yaVistosHistorial.length > 0
      ? `\nDISCOS QUE YA SE LE RECOMENDARON ANTES (PROHIBIDO repetir; elige el que lleve MÁS TIEMPO sin aparecer):\n${input.yaVistosHistorial.map((t) => `- ${t}`).join("\n")}\n`
      : "";

  const system = `Eres el curador musical de Musicart: cercano, melómano, hablas en español y de "tú".
Tu trabajo: elegir UN disco del catálogo para este usuario hoy, y explicar por qué ese disco, para él/ella, hoy.

Reglas estrictas:
1. Responde SOLO un objeto JSON: {"albumId": "...", "reason": "..."} — sin texto extra.
2. "albumId" debe ser EXACTAMENTE uno de los albumId del catálogo.
3. "reason": 1 a 3 frases en español, cálidas y concretas, citando SOLO señales reales del usuario que aparecen abajo (sus estrellas, sus respuestas, su perfil, su ánimo de hoy). Ej.: "Le diste 5★ a X…", "dijiste que buscas la historia…".
4. Sobre el disco solo puedes mencionar lo que aparece en el catálogo (título, artista, año, duración, etiquetas). PROHIBIDO inventar datos del álbum o del usuario.
5. PROHIBIDO elegir un disco que aparezca en la lista "DISCOS RECOMENDADOS EN DÍAS RECIENTES" ni en "DISCOS QUE YA SE LE RECOMENDARON ANTES". Si aun así ves que todas las opciones del catálogo están en esas listas, elige el disco que lleve MÁS TIEMPO sin aparecer (el que esté más abajo en "YA SE LE RECOMENDARON ANTES").
6. Si el usuario indicó su ánimo de hoy, dale prioridad como señal.
7. GUSTO ANTE TODO: prioriza sus géneros y artistas favoritos. Un rockero NO debe recibir un disco que choque con su gusto (p. ej. balada romántica) salvo como puente claro y bien justificado en la "reason". Mejor un disco que reconozca como suyo que uno "objetivamente importante" pero ajeno.
8. NO REPITAS EL MISMO GANCHO: en "DISCOS RECOMENDADOS EN DÍAS RECIENTES" abajo, junto a cada disco reciente, verás la razón que le diste ese día. PROHIBIDO abrir la razón de HOY con la misma anécdota, dato o escena que ya usaste ahí. Elige un ángulo distinto del perfil, el diario o el ánimo de hoy.${input.lang ? `\n9. IDIOMA DE HOY: el usuario eligió escuchar en "${input.lang}" hoy. OBLIGATORIO elegir un álbum donde el artista cante principalmente en ese idioma — el idioma del día va por encima del gusto. Si no hay ninguno en el catálogo que encaje, elige el más cercano y menciónalo en la "reason".\n   ATENCIÓN — los idiomas son distintos: "Español" (castellano) ≠ "Português" (Brasil, Portugal) ≠ "Français" ≠ "English" ≠ "Italiano". No confundas lenguas romances; un disco en portugués NO es válido cuando pidieron español.` : ""}`;

  const user = `CATÁLOGO DISPONIBLE (elige uno por su albumId):
${catalogoTexto}

PERFIL DEL USUARIO:
${perfilTexto}
${input.patronesTexto ? `\n${input.patronesTexto}\n` : ""}
SU DIARIO (reseñas recientes, de la más nueva a la más vieja):
${diarioTexto}

ÁNIMO DE HOY: ${input.mood ?? "(no indicado)"}
${peticionTexto}${regeneracionTexto}${regresoTexto}${yaVistosTexto}
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
    .map((p, i) => {
      // Solo los últimos 3 llevan su razón: para que el LLM vea qué anécdota o
      // dato ya usó y no la repita (evita la "muletilla" del mismo gancho).
      const razon =
        i < 3 && p.reason ? ` — razón que le dimos: "${p.reason.slice(0, 160)}"` : "";
      return `- ${p.date}: "${p.album.title}" de ${p.album.artist.name}${razon}`;
    })
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

// N\u00facleo del t\u00edtulo: sin diacr\u00edticos, sin par\u00e9ntesis/corchetes, sin lo que va
// tras " - ", y sin sufijos de edici\u00f3n/directo (deluxe, remaster, en directo\u2026).
// As\u00ed "Cometas por el cielo (En directo desde Am\u00e9rica)" y "Cometas por el cielo"
// se reconocen como la MISMA obra aunque las fuentes guarden t\u00edtulos distintos.
function nucleoTitulo(s: string): string {
  let t = normalizar(s);
  t = t.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ");
  t = t.split(/\s-\s/)[0];
  const m = t.match(
    /^(.*?\S.*?)\s+\b(en vivo|en directo|live|deluxe|remaster\w*|edicion|edition|expanded|bonus|reedicion|unplugged|acustico|acoustic)\b/u,
  );
  if (m && m[1].trim().length >= 3) t = m[1];
  return t
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Dos discos son la MISMA obra si comparten artista (con tolerancia) y el n\u00facleo
// del t\u00edtulo coincide. Compara por contenido, no por id de fila ni texto exacto:
// es la barrera definitiva contra el "mismo disco con t\u00edtulo o id distinto".
function mismaObra(a: { title: string; artist: string }, b: { title: string; artist: string }): boolean {
  const artistaA = normalizar(a.artist).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const artistaB = normalizar(b.artist).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const mismoArtista =
    artistaA.length > 0 &&
    (artistaA === artistaB || artistaA.includes(artistaB) || artistaB.includes(artistaA));
  if (!mismoArtista) return false;
  const nucA = nucleoTitulo(a.title);
  const nucB = nucleoTitulo(b.title);
  return nucA.length > 0 && nucA === nucB;
}

// Antigüedad de cada obra: su posición en la lista de vistos (0 = el más
// reciente, números mayores = hace más tiempo; nunca visto = el más viejo de
// todos). Cuando el oyente ya recorrió TODO el catálogo (caso típico del dueño,
// cuyo catálogo publicado ES su propio historial), esto nos deja preferir
// SIEMPRE el disco que lleva más tiempo sin aparecer y nunca re-servir el de
// ayer por agotamiento. Espera `vistosObras` ordenado del más reciente al más
// antiguo (como lo entrega cargarMemoriaDiscos).
function rangoPorRecencia(
  vistosObras: Obra[],
): (a: { title: string; artist: string }) => number {
  const rank = new Map<string, number>();
  vistosObras.forEach((o, i) => {
    const k = `${normalizar(o.artist)}||${nucleoTitulo(o.title)}`;
    if (!rank.has(k)) rank.set(k, i);
  });
  return (a) =>
    rank.get(`${normalizar(a.artist)}||${nucleoTitulo(a.title)}`) ??
    Number.MAX_SAFE_INTEGER;
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
