// Fase 9 — Lectura del Salón de la Fama.
//
// Todo lo que la pestaña `/salon` necesita saber. Es deliberadamente barato:
// consultas a la tabla `CanonAlbum` y aritmética. Ni una llamada a un LLM, ni
// una petición a una API externa — el índice ya viene calculado de la ingesta,
// así que el Salón carga instantáneo y no consume presupuesto de IA.

import type { CanonAlbum, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { parseJson } from "../types";
import {
  reviewsWhere,
  findProfileRecord,
  type ListenerIdentity,
} from "../identity";
import { canonKey } from "./ingest";
import { PISOS, pisoDe, type Piso } from "./score";

export type SalonAlbum = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  coverUrl: string | null;
  score: number;
  /** Nombre del piso ("Inmortales", "Hitos"…). */
  piso: string;
  /** Los recibos del puntaje: por qué este disco vale lo que vale. */
  evidencia: string[];
  generos: string[];
  country: string | null;
  /** Álbum del catálogo si ya tiene dossier; null = hay que fabricarlo. */
  albumId: string | null;
  /** El curador fijó este puntaje a mano: la ingesta no lo recalcula (9.7). */
  bloqueado: boolean;
};

export function aSalonAlbum(c: CanonAlbum): SalonAlbum {
  return {
    id: c.id,
    title: c.title,
    artist: c.artist,
    year: c.year,
    coverUrl: c.coverUrl,
    score: c.score,
    piso: pisoDe(c.score).nombre,
    evidencia: parseJson<string[]>(c.evidenceJson, []),
    generos: parseJson<string[]>(c.genresJson, []),
    country: c.country,
    albumId: c.albumId,
    bloqueado: c.locked,
  };
}

/**
 * Lo que el curador necesita ver para gobernar la cima (9.7): los discos que ya
 * fijó a mano, y detrás los más altos que todavía dependen de la fórmula.
 */
export async function getCanonCurado(limite = 40): Promise<{
  fijados: SalonAlbum[];
  candidatos: SalonAlbum[];
  total: number;
}> {
  const [fijados, candidatos, total] = await Promise.all([
    prisma.canonAlbum.findMany({
      where: { locked: true },
      orderBy: [{ score: "desc" }, { title: "asc" }],
      take: limite,
    }),
    prisma.canonAlbum.findMany({
      where: { locked: false },
      orderBy: [{ score: "desc" }, { raw: "desc" }],
      take: limite,
    }),
    prisma.canonAlbum.count(),
  ]);

  return {
    fijados: fijados.map(aSalonAlbum),
    candidatos: candidatos.map(aSalonAlbum),
    total,
  };
}

/**
 * El muro de los inmortales: el club de los 100. Si el índice todavía es
 * pequeño y nadie llegó a 100, baja el listón en vez de enseñar un muro vacío
 * (mejor "los más altos que tenemos" que una promesa incumplida).
 *
 * Lo que NO se enseña nunca es un disco sin calibrar. El 0 no es un puntaje
 * bajo, es la ausencia de puntaje (ver `contarSinPuntaje`), y colarlo aquí fue
 * la cara visible del peor fallo que ha tenido el Salón: un muro de inmortales
 * con Thriller marcado "0 de 100". Antes que enseñar un número falso, el muro
 * se queda vacío y la pestaña dice la verdad — que todavía se está levantando.
 */
export async function getMuro(limite = 24): Promise<SalonAlbum[]> {
  const cien = await prisma.canonAlbum.findMany({
    where: { score: 100 },
    orderBy: [{ raw: "desc" }],
    take: limite,
  });
  if (cien.length > 0) return cien.map(aSalonAlbum);

  const mejores = await prisma.canonAlbum.findMany({
    where: { score: { gt: 0 } },
    orderBy: [{ score: "desc" }, { raw: "desc" }],
    take: limite,
  });
  return mejores.map(aSalonAlbum);
}

export type EstadoSalon = {
  /** Discos en el índice. */
  total: number;
  /** Los que ya tienen puntaje: los únicos que el Salón puede enseñar. */
  conPuntaje: number;
  /** Los que entraron al índice pero nunca llegaron a calibrarse. */
  sinPuntaje: number;
};

/**
 * En qué punto está el Salón. Sirve para no confundir dos situaciones que se
 * ven igual desde fuera (una pestaña sin discos) y se arreglan distinto: no
 * haber traído el canon todavía, o haberlo traído y no haberle puesto números.
 */
export async function estadoDelSalon(): Promise<EstadoSalon> {
  const [total, sinPuntaje] = await Promise.all([
    prisma.canonAlbum.count(),
    prisma.canonAlbum.count({ where: { score: 0 } }),
  ]);
  return { total, conPuntaje: total - sinPuntaje, sinPuntaje };
}

export type PisoConteo = Piso & { total: number };

/** Cuántos discos hay en cada piso del Salón (para la navegación). */
export async function contarPorPiso(): Promise<PisoConteo[]> {
  const filas = await prisma.canonAlbum.groupBy({
    by: ["score"],
    // Sin calibrar no es "Notable": es que todavía no tiene número. Contarlos
    // en el piso de abajo inflaba el Salón con discos que no se pueden abrir.
    where: { score: { gt: 0 } },
    _count: { _all: true },
  });

  return PISOS.map((piso) => {
    const techo = PISOS.find((p) => p.min > piso.min)?.min ?? 101;
    const total = filas
      .filter((f) => f.score >= piso.min && f.score < techo)
      .reduce((acc, f) => acc + f._count._all, 0);
    return { ...piso, total };
  }).filter((p) => p.total > 0);
}

export type FiltrosCanon = {
  min?: number;
  max?: number;
  decada?: number;
  pais?: string;
  genero?: string;
  pagina?: number;
  porPagina?: number;
};

export type ListadoCanon = {
  albums: SalonAlbum[];
  total: number;
  pagina: number;
  paginas: number;
};

/** Listado paginado del canon con filtros de década, país y género. */
export async function listarCanon(f: FiltrosCanon = {}): Promise<ListadoCanon> {
  const porPagina = Math.min(Math.max(f.porPagina ?? 48, 1), 120);
  const pagina = Math.max(f.pagina ?? 1, 1);

  const where = {
    // El `gt: 0` va siempre: un disco sin calibrar no está listo para el
    // escaparate, y enseñarlo sería enseñar un "0 de 100" que no significa nada.
    score: {
      gt: 0,
      ...(f.min !== undefined ? { gte: f.min } : {}),
      ...(f.max !== undefined ? { lte: f.max } : {}),
    },
    ...(f.decada ? { decade: f.decada } : {}),
    ...(f.pais ? { country: f.pais.toUpperCase() } : {}),
    // `genresJson` es un String con un array dentro: buscar la etiqueta entre
    // comillas evita que "Punk" case dentro de "Post-Punk".
    ...(f.genero ? { genresJson: { contains: `"${f.genero}"` } } : {}),
  };

  const [total, filas] = await Promise.all([
    prisma.canonAlbum.count({ where }),
    prisma.canonAlbum.findMany({
      where,
      orderBy: [{ score: "desc" }, { raw: "desc" }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
  ]);

  return {
    albums: filas.map(aSalonAlbum),
    total,
    pagina,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}

/** Décadas, países y géneros que existen de verdad en el índice. */
export async function filtrosDisponibles(): Promise<{
  decadas: number[];
  paises: { code: string; nombre: string; total: number }[];
  generos: string[];
}> {
  const [decadas, paises, filas] = await Promise.all([
    prisma.canonAlbum.groupBy({
      by: ["decade"],
      where: { decade: { not: null } },
      _count: { _all: true },
    }),
    prisma.canonAlbum.groupBy({
      by: ["country"],
      where: { country: { not: null } },
      _count: { _all: true },
    }),
    prisma.canonAlbum.findMany({
      where: { NOT: { genresJson: "[]" } },
      select: { genresJson: true },
    }),
  ]);

  const generos = new Set<string>();
  for (const f of filas) {
    for (const g of parseJson<string[]>(f.genresJson, [])) generos.add(g);
  }

  return {
    decadas: decadas
      .map((d) => d.decade as number)
      .sort((a, b) => b - a),
    paises: paises
      .map((p) => ({
        code: p.country as string,
        nombre: nombrePais(p.country as string),
        total: p._count._all,
      }))
      // Un país con dos discos no es un canon: no merece su propia pestaña.
      .filter((p) => p.total >= 3)
      .sort((a, b) => b.total - a.total),
    generos: [...generos].sort(),
  };
}

function nombrePais(code: string): string {
  try {
    return new Intl.DisplayNames(["es"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

// ── "Dame un disco de 95" ────────────────────────────────────────────────────

export type DiscoDePuntaje = {
  album: SalonAlbum;
  /** Por qué le tocó este y no otro de los cientos que hay en ese puntaje. */
  porque: string;
};

/**
 * El dial: el oyente marca un puntaje y recibe UN disco de esa altura exacta.
 *
 * Personalizado sin gastar un céntimo de IA: se ordenan los candidatos por
 * afinidad con sus géneros y artistas de siempre, se descartan los que ya
 * escuchó, y se desempata con una semilla del día para que mañana el mismo
 * puntaje dé un disco distinto. Determinista y explicable.
 */
export async function discoDePuntaje(
  score: number,
  identity: ListenerIdentity,
  semilla = new Date().toISOString().slice(0, 10),
  /** Ids del canon que el dial ya entregó antes (los recuerda quien llama).
   *  Sin esto el dial es un botón que da SIEMPRE el mismo disco: la afinidad
   *  manda, el ruido es determinista y la semilla solo cambia de día en día, así
   *  que pulsarlo diez veces devolvía diez veces lo mismo. */
  yaDados: string[] = [],
): Promise<DiscoDePuntaje | null> {
  const objetivo = Math.min(100, Math.max(55, Math.round(score)));
  const dados = new Set(yaDados);

  // Buscamos en el puntaje exacto y, si ahí no queda nada que no haya oído, se
  // abre a ±2 antes que dejarlo con las manos vacías.
  for (const margen of [0, 1, 2]) {
    const todos = await prisma.canonAlbum.findMany({
      where: { score: { gte: objetivo - margen, lte: objetivo + margen } },
      take: 400,
    });
    if (todos.length === 0) continue;

    // Lo ya entregado sale de la baraja mientras quede otra cosa que dar.
    const sinRepetir = todos.filter((c) => !dados.has(c.id));
    const candidatos = sinRepetir.length > 0 ? sinRepetir : todos;

    const yaEscuchados = await clavesYaEscuchadas(identity);
    const frescos = candidatos.filter(
      (c) => !yaEscuchados.has(canonKey(c.title, c.artist)),
    );
    const pool = frescos.length > 0 ? frescos : candidatos;

    const { generos, artistas } = await gustosDelOyente(identity);
    const puntuados = pool.map((c) => ({
      c,
      afinidad: afinidadCon(c, generos, artistas) + ruido(c.id + semilla),
    }));
    puntuados.sort((a, b) => b.afinidad - a.afinidad);

    const elegido = puntuados[0];
    return {
      album: aSalonAlbum(elegido.c),
      porque: explicar(elegido.c, generos, artistas, objetivo, frescos.length === 0),
    };
  }

  return null;
}

/** Afinidad 0..2 de un disco del canon con los gustos declarados del oyente. */
function afinidadCon(
  c: CanonAlbum,
  generos: Set<string>,
  artistas: Set<string>,
): number {
  let a = 0;
  if (artistas.has(normalizar(c.artist))) a += 1.2;
  for (const g of parseJson<string[]>(c.genresJson, [])) {
    if (generos.has(normalizar(g))) {
      a += 0.8;
      break;
    }
  }
  return a;
}

/**
 * Ruido determinista 0..0,5 a partir de un texto. Sirve para que dos discos con
 * la misma afinidad no salgan siempre en el mismo orden, sin usar Math.random
 * (que rompería el renderizado en servidor: el mismo día tiene que dar lo mismo).
 */
function ruido(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i++) {
    h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return (h % 1000) / 2000;
}

function explicar(
  c: CanonAlbum,
  generos: Set<string>,
  artistas: Set<string>,
  objetivo: number,
  sinFrescos: boolean,
): string {
  const partes: string[] = [];

  if (c.score === objetivo) {
    partes.push(`Un ${c.score} de 100 exacto`);
  } else {
    partes.push(`Lo más cerca que hay de un ${objetivo}: este es un ${c.score}`);
  }

  if (artistas.has(normalizar(c.artist))) {
    partes.push(`y ${c.artist} ya estaba en tus favoritos`);
  } else {
    const g = parseJson<string[]>(c.genresJson, []).find((x) =>
      generos.has(normalizar(x)),
    );
    if (g) partes.push(`y cae en ${g}, que es de lo tuyo`);
  }

  if (sinFrescos) partes.push("(ya lo tenías escuchado, pero se te fue quedando)");

  return `${partes.join(" ")}.`;
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

async function gustosDelOyente(identity: ListenerIdentity): Promise<{
  generos: Set<string>;
  artistas: Set<string>;
}> {
  const generos = new Set<string>();
  const artistas = new Set<string>();

  const perfil = await findProfileRecord(identity);
  if (perfil) {
    const answers = parseJson<Record<string, unknown>>(perfil.answersJson, {});
    for (const clave of ["genres", "spotifyGenres"]) {
      for (const g of comoLista(answers[clave])) generos.add(normalizar(g));
    }
    for (const clave of ["artists", "spotifyArtists"]) {
      for (const a of comoLista(answers[clave])) artistas.add(normalizar(a));
    }
  }

  return { generos, artistas };
}

function comoLista(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((x): x is string => typeof x === "string") : [];
}

/** Claves ("artista|título") de lo que el oyente ya reseñó o ya le tocó de pick. */
async function clavesYaEscuchadas(identity: ListenerIdentity): Promise<Set<string>> {
  const wReviews = reviewsWhere(identity);
  // Los picks los filtramos aquí y no con `pastPicksWhere` porque ese excluye
  // el día en curso a propósito (lo necesita el motor del disco diario) y para
  // el Salón el disco de hoy también cuenta como escuchado.
  const wPicks: Prisma.DailyPickWhereInput | null = identity.userId
    ? {
        OR: [
          { userId: identity.userId },
          ...(identity.deviceId ? [{ deviceId: identity.deviceId }] : []),
        ],
      }
    : identity.deviceId
      ? { deviceId: identity.deviceId }
      : null;
  const claves = new Set<string>();

  const incluir = { album: { include: { artist: true } } } as const;
  const [reviews, picks] = await Promise.all([
    wReviews
      ? prisma.review.findMany({ where: wReviews, include: incluir, take: 300 })
      : Promise.resolve([]),
    wPicks
      ? prisma.dailyPick.findMany({ where: wPicks, include: incluir, take: 300 })
      : Promise.resolve([]),
  ]);

  for (const r of [...reviews, ...picks]) {
    claves.add(canonKey(r.album.title, r.album.artist.name));
  }
  return claves;
}

// ── El progreso del oyente ───────────────────────────────────────────────────

export type ProgresoCanon = {
  /** Cuántos de los discos más altos del canon ya pasaron por su diario. */
  escuchados: number;
  /** Sobre cuántos (el tamaño del tramo que miramos). */
  total: number;
  /** Los que le faltan, de mayor puntaje a menor, para invitarlo a seguir. */
  siguientes: SalonAlbum[];
};

/**
 * "Llevas 7 de los 100." Se calcula sobre el tramo más alto del canon porque es
 * el que significa algo como colección. No es una racha ni una medalla: es su
 * propia historia contada contra el canon.
 */
export async function progresoDelOyente(
  identity: ListenerIdentity,
  tramo = 100,
): Promise<ProgresoCanon> {
  const cima = await prisma.canonAlbum.findMany({
    where: { score: { gt: 0 } },
    orderBy: [{ score: "desc" }, { raw: "desc" }],
    take: tramo,
  });
  if (cima.length === 0) return { escuchados: 0, total: 0, siguientes: [] };

  const yaEscuchados = await clavesYaEscuchadas(identity);
  const faltan = cima.filter((c) => !yaEscuchados.has(canonKey(c.title, c.artist)));

  return {
    escuchados: cima.length - faltan.length,
    total: cima.length,
    siguientes: faltan.slice(0, 6).map(aSalonAlbum),
  };
}

/** Un disco del canon por id, para su ficha. */
export async function getCanonAlbum(id: string): Promise<SalonAlbum | null> {
  const c = await prisma.canonAlbum.findUnique({ where: { id } });
  return c ? aSalonAlbum(c) : null;
}
