// Fase 9 — La ingesta del índice del canon.
//
// Llena y refresca la tabla `CanonAlbum`. Corre FUERA de la app (script
// `npm run canon`, como el worker del catálogo), porque tarda minutos y habla
// con varias APIs públicas: nada de esto puede pasar mientras un oyente espera.
//
// El orden importa:
//   1. Wikidata da el universo (qué discos entran) y las señales fuertes.
//   2. Last.fm añade oyentes (señal débil, opcional: sin API key se omite).
//   3. Se calcula el prestigio bruto de cada uno y se guardan sus recibos.
//   4. Se recalibra el índice ENTERO por percentil → puntaje 1-100.
//
// El paso 4 es el que da coherencia y por eso se hace al final y sobre todo el
// índice: un puntaje aquí no significa "tuvimos mucha evidencia de este disco",
// significa "este disco está por encima del 94% del canon".

import { prisma } from "../db";
import { buscarAlbumesCanonicos, premiosDeAlbumes } from "../sources/wikidata";
import { getAlbumInfo } from "../sources/lastfm";
import { searchAlbums } from "../sources/deezer";
import { deriveGenres } from "../genres";
import {
  calibrar,
  prestigioBruto,
  recibos,
  type CanonSignals,
} from "./score";

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clave anti-duplicados del índice: "artista|título" normalizado. */
export function canonKey(title: string, artist: string): string {
  return `${normalizar(artist)}|${normalizar(title)}`;
}

function decadaDe(year: number | null): number | null {
  if (!year || year < 1900) return null;
  return Math.floor(year / 10) * 10;
}

export type ResumenIngesta = {
  candidatos: number;
  nuevos: number;
  actualizados: number;
  conPremios: number;
  recalibrados: number;
};

/**
 * Construye o refresca el índice. Idempotente: correrlo dos veces no duplica
 * nada (la clave es "artista|título") y respeta los puntajes que el curador
 * haya fijado a mano.
 */
export async function construirIndice(opciones: {
  limite?: number;
  minSitelinks?: number;
  conOyentes?: boolean;
  log?: (msg: string) => void;
} = {}): Promise<ResumenIngesta> {
  const {
    limite = 1000,
    minSitelinks = 15,
    conOyentes = true,
    log = () => {},
  } = opciones;

  log(`Pidiendo a Wikidata hasta ${limite} discos (≥${minSitelinks} ediciones de Wikipedia)…`);
  const candidatos = await buscarAlbumesCanonicos(limite, minSitelinks);
  log(`Wikidata devolvió ${candidatos.length} discos distintos.`);
  if (candidatos.length === 0) {
    throw new Error(
      "Wikidata no devolvió ningún disco. Revisa la consulta o el estado del endpoint " +
        "antes de dar el índice por bueno: un índice vacío no es un índice.",
    );
  }

  log("Pidiendo los premios de cada disco…");
  const premios = await premiosDeAlbumes(
    candidatos.map((c) => c.wikidataId),
    200,
    log,
  );
  log(`${premios.size} discos tienen al menos un premio registrado.`);

  let nuevos = 0;
  let actualizados = 0;

  for (const c of candidatos) {
    const key = canonKey(c.title, c.artist);

    // Oyentes: señal débil y opcional. Si no hay LASTFM_API_KEY, `getAlbumInfo`
    // devuelve null y seguimos sin ella — el puntaje se sostiene igual.
    let listeners: number | null = null;
    let tags: string[] = [];
    if (conOyentes) {
      try {
        const info = await getAlbumInfo(c.title, c.artist);
        listeners = info?.listeners ?? null;
        tags = info?.tags ?? [];
      } catch {
        // Last.fm caído no puede tumbar la ingesta.
      }
    }

    const signals: CanonSignals = {
      sitelinks: c.sitelinks,
      awards: premios.get(c.wikidataId) ?? [],
      listeners,
      ratingVotes: null,
    };

    // Mismos géneros canónicos que ya usa el catálogo, derivados de etiquetas
    // reales: si Last.fm no conoce el disco, se queda sin género antes que
    // inventarle uno.
    const generos = deriveGenres(tags);

    const datos = {
      title: c.title,
      artist: c.artist,
      year: c.year,
      decade: decadaDe(c.year),
      country: c.country,
      mbid: c.mbid,
      wikidataId: c.wikidataId,
      raw: prestigioBruto(signals),
      signalsJson: JSON.stringify(signals),
      evidenceJson: JSON.stringify(recibos(signals)),
      genresJson: JSON.stringify(generos),
    };

    const existente = await prisma.canonAlbum.findUnique({ where: { key } });
    if (existente) {
      await prisma.canonAlbum.update({ where: { key }, data: datos });
      actualizados++;
    } else {
      await prisma.canonAlbum.create({ data: { key, ...datos } });
      nuevos++;
    }
  }

  log(`Índice: ${nuevos} discos nuevos, ${actualizados} actualizados.`);

  await enlazarConCatalogo(log);
  const recalibrados = await recalibrar(log);

  return {
    candidatos: candidatos.length,
    nuevos,
    actualizados,
    conPremios: premios.size,
    recalibrados,
  };
}

/**
 * Recalcula el puntaje 1-100 de TODO el índice a partir de los prestigios
 * brutos ya guardados. Es barato (no toca ninguna API) y hay que correrlo cada
 * vez que entran discos nuevos: el puntaje es una posición relativa, así que
 * ampliar el canon puede mover a todos un peldaño.
 */
export async function recalibrar(log: (msg: string) => void = () => {}): Promise<number> {
  const filas = await prisma.canonAlbum.findMany({
    select: { id: true, raw: true, locked: true, score: true },
  });
  if (filas.length === 0) return 0;

  const nuevos = calibrar(filas);
  const previo = new Map(filas.map((f) => [f.id, f]));

  let cambiados = 0;
  for (const n of nuevos) {
    const antes = previo.get(n.id);
    // Los puntajes fijados a mano por el curador no se tocan: son la parte del
    // Salón donde manda su criterio y no la fórmula.
    if (!antes || antes.locked || antes.score === n.score) continue;
    await prisma.canonAlbum.update({
      where: { id: n.id },
      data: { score: n.score },
    });
    cambiados++;
  }

  log(`Recalibrado: ${cambiados} puntajes cambiaron de ${filas.length} discos.`);
  return cambiados;
}

/**
 * Cose el índice con el catálogo: si un disco del canon YA tiene dossier
 * publicado, guardamos su `albumId` para que la pestaña enlace directo en vez
 * de mandar a fabricarlo otra vez.
 */
export async function enlazarConCatalogo(
  log: (msg: string) => void = () => {},
): Promise<number> {
  const sinEnlace = await prisma.canonAlbum.findMany({
    where: { albumId: null },
    select: { id: true, title: true, artist: true },
  });
  if (sinEnlace.length === 0) return 0;

  const albums = await prisma.album.findMany({
    select: { id: true, title: true, artist: { select: { name: true } } },
  });
  const porClave = new Map(
    albums.map((a) => [canonKey(a.title, a.artist.name), a.id]),
  );

  let enlazados = 0;
  for (const c of sinEnlace) {
    const albumId = porClave.get(canonKey(c.title, c.artist));
    if (!albumId) continue;
    // `albumId` es único en el índice: si otro disco del canon ya lo reclamó
    // (mismo álbum con dos entradas en Wikidata), lo dejamos pasar.
    try {
      await prisma.canonAlbum.update({ where: { id: c.id }, data: { albumId } });
      enlazados++;
    } catch {
      // Choque de unicidad: no es un error que deba detener la ingesta.
    }
  }

  if (enlazados > 0) log(`${enlazados} discos del canon ya tenían dossier en el catálogo.`);
  return enlazados;
}

/**
 * Rellena carátulas con Deezer, de mayor a menor puntaje. Va aparte y con tope
 * porque son mil peticiones a una API pública gratuita: se corre a ratos
 * (`npm run canon -- --portadas 200`) y retoma donde se quedó, en vez de
 * castigar a Deezer de golpe y arriesgar un bloqueo.
 */
export async function rellenarPortadas(
  max = 200,
  log: (msg: string) => void = () => {},
): Promise<number> {
  const pendientes = await prisma.canonAlbum.findMany({
    where: { coverUrl: null },
    orderBy: { score: "desc" },
    take: max,
    select: { id: true, title: true, artist: true },
  });

  let puestas = 0;
  for (const p of pendientes) {
    try {
      const [mejor] = await searchAlbums(`${p.artist} ${p.title}`, 1);
      if (mejor?.cover) {
        await prisma.canonAlbum.update({
          where: { id: p.id },
          data: { coverUrl: mejor.cover },
        });
        puestas++;
      }
    } catch {
      // Una portada que no llega no es motivo para parar (el seed ya vive con esto).
    }
    await new Promise((r) => setTimeout(r, 350));
  }

  log(`Portadas: ${puestas} de ${pendientes.length} intentadas.`);
  return puestas;
}
