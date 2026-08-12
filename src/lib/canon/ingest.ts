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
import { parseJson } from "../types";
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
  /** Se acabó el tiempo antes de recorrer todos los candidatos (corrida web). */
  incompleta: boolean;
};

/**
 * Construye o refresca el índice. Idempotente: correrlo dos veces no duplica
 * nada (la clave es "artista|título") y respeta los puntajes que el curador
 * haya fijado a mano.
 *
 * `presupuestoMs` existe para poder correr esto desde una función de Vercel sin
 * que la corten a medias: al agotarse, deja de meter discos nuevos pero SIEMPRE
 * termina enlazando y recalibrando, así que el índice queda coherente aunque
 * esté a medio llenar. Los candidatos vienen ordenados por documentación, o sea
 * que lo que entra primero es lo más canónico.
 */
export async function construirIndice(opciones: {
  limite?: number;
  minSitelinks?: number;
  conOyentes?: boolean;
  presupuestoMs?: number;
  /** Solo meter lo que falta (para crecer el índice a ratos, sin repetir trabajo). */
  soloNuevos?: boolean;
  log?: (msg: string) => void;
} = {}): Promise<ResumenIngesta> {
  const {
    limite = 1000,
    minSitelinks = 15,
    conOyentes = true,
    presupuestoMs,
    soloNuevos = false,
    log = () => {},
  } = opciones;

  const arranque = Date.now();
  const sinTiempo = () =>
    presupuestoMs !== undefined && Date.now() - arranque > presupuestoMs;
  // La red se lleva como mucho la mitad del presupuesto: la otra mitad es para
  // escribir en la base y recalibrar, que es lo que deja el índice coherente.
  // Sin este reparto, un Wikidata lento se comía la corrida entera y no se
  // guardaba ni un disco de los que sí había traído.
  const hasta = (fraccion: number) =>
    presupuestoMs === undefined ? undefined : arranque + presupuestoMs * fraccion;

  log(`Pidiendo a Wikidata hasta ${limite} discos (≥${minSitelinks} ediciones de Wikipedia)…`);
  const candidatos = await buscarAlbumesCanonicos(limite, minSitelinks, {
    deadline: hasta(0.5),
    log,
  });
  log(`Wikidata devolvió ${candidatos.length} discos distintos.`);
  if (candidatos.length === 0) {
    throw new Error(
      "Wikidata no devolvió ningún disco. Revisa la consulta o el estado del endpoint " +
        "antes de dar el índice por bueno: un índice vacío no es un índice.",
    );
  }

  // Los premios son varias consultas más. Si la corrida va con prisa y ya se
  // gastó media hora de reloj buscando candidatos, se saltan: es mejor un índice
  // sin premios hoy (los añade la siguiente corrida) que ninguno.
  const premiosPedidos =
    presupuestoMs === undefined || Date.now() - arranque <= presupuestoMs / 2;
  let premios = new Map<string, string[]>();
  if (premiosPedidos) {
    log("Pidiendo los premios de cada disco…");
    premios = await premiosDeAlbumes(
      candidatos.map((c) => c.wikidataId),
      200,
      { deadline: hasta(0.7), log },
    );
    log(`${premios.size} discos tienen al menos un premio registrado.`);
  } else {
    log("Sin tiempo para los premios en esta corrida: los añade la siguiente.");
  }

  // Lo que ya hay, de una sola consulta: así el bucle escribe con un `upsert`
  // en vez de preguntar disco por disco si existe (la mitad de viajes a la base,
  // que es lo que decide si esto cabe o no en una corrida desde la web).
  const previas = new Map(
    (
      await prisma.canonAlbum.findMany({
        select: {
          key: true,
          genresJson: true,
          signalsJson: true,
          // Los datos que una corrida con prisa puede no traer (país y mbid van
          // en consultas aparte que se saltan si se acaba el tiempo): se leen
          // para conservarlos, nunca para borrarlos con un null.
          year: true,
          country: true,
          mbid: true,
        },
      })
    ).map((p) => [p.key, p]),
  );

  let nuevos = 0;
  let actualizados = 0;
  let fallidos = 0;
  let incompleta = false;

  for (const c of candidatos) {
    if (sinTiempo()) {
      incompleta = true;
      log(
        `Se acabó el tiempo de esta corrida: entraron ${nuevos + actualizados} de ` +
          `${candidatos.length} discos. Vuelve a correrla para seguir donde quedó.`,
      );
      break;
    }

    const key = canonKey(c.title, c.artist);
    const previa = previas.get(key);
    if (soloNuevos && previa) continue;

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

    // Una corrida rápida (sin Last.fm) NO puede borrar lo que trajo una lenta:
    // si el disco ya tenía oyentes y géneros, se conservan tal cual.
    const previos = previa
      ? parseJson<Partial<CanonSignals>>(previa.signalsJson, {})
      : null;
    if (!conOyentes && typeof previos?.listeners === "number") {
      listeners = previos.listeners;
    }

    const signals: CanonSignals = {
      sitelinks: c.sitelinks,
      // Si esta corrida no trajo premios de este disco (porque no se preguntó,
      // porque su lote falló o porque se acabó el tiempo), se conservan los que
      // ya tenía: saltarse una consulta no es motivo para borrar un Grammy, y
      // un premio no se revoca.
      awards: premios.get(c.wikidataId) ?? previos?.awards ?? [],
      listeners,
      ratingVotes: null,
    };

    // Mismos géneros canónicos que ya usa el catálogo, derivados de etiquetas
    // reales: si Last.fm no conoce el disco, se queda sin género antes que
    // inventarle uno.
    const generosNuevos = deriveGenres(tags);
    const generosPrevios = previa
      ? parseJson<string[]>(previa.genresJson, [])
      : [];
    const generos =
      generosNuevos.length > 0 ? generosNuevos : generosPrevios;

    // Mismo criterio que con los premios y los géneros: lo que esta corrida no
    // trajo no se borra, se hereda. Si no, una corrida corta dejaba el canon sin
    // países (y con él, sin el "canon con acento") hasta la siguiente larga.
    const year = c.year ?? previa?.year ?? null;

    const datos = {
      title: c.title,
      artist: c.artist,
      year,
      decade: decadaDe(year),
      country: c.country ?? previa?.country ?? null,
      mbid: c.mbid ?? previa?.mbid ?? null,
      wikidataId: c.wikidataId,
      raw: prestigioBruto(signals),
      signalsJson: JSON.stringify(signals),
      evidenceJson: JSON.stringify(recibos(signals)),
      genresJson: JSON.stringify(generos),
    };

    try {
      await prisma.canonAlbum.upsert({
        where: { key },
        create: { key, ...datos },
        update: datos,
      });
      if (previa) actualizados++;
      else nuevos++;
    } catch (err) {
      // Un disco que no entra no puede tumbar la corrida entera. Pasa de
      // verdad: `mbid` y `wikidataId` son únicos, y Wikidata a veces trae dos
      // fichas del mismo disco con títulos ligeramente distintos — la segunda
      // choca contra la primera. Antes ese choque abortaba `construirIndice`
      // ANTES de recalibrar, y el índice se quedaba entero sin puntaje.
      fallidos++;
      log(`⚠ No entró «${c.title}» de ${c.artist}: ${(err as Error).message}`);
    }
  }

  log(
    `Índice: ${nuevos} discos nuevos, ${actualizados} actualizados` +
      (fallidos > 0 ? `, ${fallidos} que no entraron.` : "."),
  );

  await enlazarConCatalogo(log);
  const recalibrados = await recalibrar(log);

  return {
    candidatos: candidatos.length,
    nuevos,
    actualizados,
    conPremios: premios.size,
    recalibrados,
    incompleta,
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

  // Se agrupa por puntaje de destino antes de escribir. Los puntajes son ~46
  // números enteros (55 a 100) para mil discos, así que esto son ~46
  // escrituras en vez de mil, y la calibración pasa de minutos a un suspiro.
  //
  // No es una optimización cosmética: era LA razón por la que el Salón se veía
  // con todo a "0 de 100". Escribir mil `update` seguidos desde una función de
  // Vercel no cabe en el tiempo que tiene —y la calibración es lo ÚLTIMO que
  // hace la ingesta—, así que la cortaban justo aquí y los discos se quedaban
  // con el 0 de fábrica por mucho que el índice estuviera lleno.
  const porPuntaje = new Map<number, string[]>();
  for (const n of nuevos) {
    const antes = previo.get(n.id);
    // Los puntajes fijados a mano por el curador no se tocan: son la parte del
    // Salón donde manda su criterio y no la fórmula.
    if (!antes || antes.locked || antes.score === n.score) continue;
    const lista = porPuntaje.get(n.score);
    if (lista) lista.push(n.id);
    else porPuntaje.set(n.score, [n.id]);
  }

  let cambiados = 0;
  for (const [score, ids] of porPuntaje) {
    // De 500 en 500: un `IN` con miles de identificadores es una consulta que
    // Postgres puede rechazar, y aquí no hay ninguna prisa por apurarlo.
    for (let i = 0; i < ids.length; i += 500) {
      // El `locked: false` se repite en el filtro a propósito: entre la lectura
      // y esta escritura el curador pudo fijar un puntaje a mano, y manda él.
      const r = await prisma.canonAlbum.updateMany({
        where: { id: { in: ids.slice(i, i + 500) }, locked: false },
        data: { score },
      });
      cambiados += r.count;
    }
  }

  log(`Recalibrado: ${cambiados} puntajes cambiaron de ${filas.length} discos.`);
  return cambiados;
}

/**
 * Discos del índice que siguen sin puntaje. El 0 es el valor de fábrica de la
 * columna y NINGÚN disco calibrado puede tenerlo (la curva empieza en 55 y lo
 * que mete el curador a mano también), así que "score = 0" significa exactamente
 * una cosa: a este disco nunca le llegó la calibración.
 */
export async function contarSinPuntaje(): Promise<number> {
  return prisma.canonAlbum.count({ where: { score: 0 } });
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
  presupuestoMs?: number,
): Promise<number> {
  const arranque = Date.now();
  const pendientes = await prisma.canonAlbum.findMany({
    where: { coverUrl: null },
    orderBy: { score: "desc" },
    take: max,
    select: { id: true, title: true, artist: true },
  });

  let puestas = 0;
  for (const p of pendientes) {
    if (presupuestoMs !== undefined && Date.now() - arranque > presupuestoMs) break;
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

// ─── Levantar el Salón sin terminal (9.10) ───────────────────────────────────
//
// El índice se construía solo con `npm run canon`, y eso dejaba el Salón vacío
// hasta que el dueño se sentara delante de una computadora. Aquí abajo está lo
// que arregla eso: UNA operación que hace "lo siguiente que haga falta" y cabe
// en el tiempo que le des. La llaman dos sitios: el botón del panel de revisión
// (desde el teléfono, a trozos) y el worker de Railway (de noche, entero).

/** A cuántos discos aspira el índice. Con mil, el 100 es ~0,4%: 4-7 discos. */
export const OBJETIVO_INDICE = 1000;

export type AvanceSalon = {
  paso: "indice" | "portadas" | "al-dia";
  /** Frase para el dueño, en cristiano: qué acaba de pasar. */
  mensaje: string;
  /** ¿Hay que volver a darle? (el botón lo dice sin tecnicismos) */
  quedaTrabajo: boolean;
  total: number;
  sinPortada: number;
};

/**
 * Da un paso de construcción del Salón y cuenta qué hizo. Idempotente y
 * reanudable: si se acaba el tiempo, lo que entró se queda y la siguiente
 * corrida sigue donde esta lo dejó.
 */
export async function avanzarSalon(opciones: {
  presupuestoMs?: number;
  conOyentes?: boolean;
  log?: (msg: string) => void;
} = {}): Promise<AvanceSalon> {
  const { presupuestoMs, conOyentes = false, log = () => {} } = opciones;
  const arranque = Date.now();
  const restante = () =>
    presupuestoMs === undefined ? undefined : presupuestoMs - (Date.now() - arranque);

  let total = await prisma.canonAlbum.count();
  let arrastre = ""; // lo que ya contó un paso anterior, si pasó al siguiente
  // Si Wikidata se cae, aquí queda el motivo — pero la corrida NO se acaba: las
  // carátulas son de otra casa (Deezer) y se pueden seguir buscando igual.
  let fallo: string | null = null;

  // 0. Antes que nada: que ningún disco del índice se quede sin puntaje.
  //
  // La calibración vivía SOLO al final de `construirIndice`, y eso la hacía
  // rehén de todo lo que puede salir mal antes: un 502 de Wikidata, un disco
  // duplicado, o sencillamente que se acabe el tiempo de la función. Cuando
  // alguna de esas pasaba, el índice quedaba lleno pero con todos los discos en
  // "0 de 100" — y ninguna corrida posterior lo arreglaba, porque todas
  // volvían a tropezar en el mismo sitio antes de llegar al final.
  //
  // Aquí arriba ya no depende de nada: no toca la red, es una lectura y un
  // puñado de escrituras agrupadas, y se hace SIEMPRE que haga falta. Un toque
  // al botón basta para que el Salón tenga números.
  if (total > 0) {
    const sinPuntaje = await contarSinPuntaje();
    if (sinPuntaje > 0) {
      log(`${sinPuntaje} discos del índice están sin puntaje: calibrando…`);
      const puestos = await recalibrar(log);
      if (puestos > 0) {
        arrastre =
          `Le puse puntaje a ${puestos} discos que se habían quedado en cero. `;
      }
    }
  }

  // 1. Lo primero es que haya canon. Mientras falten discos, el resto espera.
  if (total < OBJETIVO_INDICE) {
    try {
      const resumen = await construirIndice({
        limite: OBJETIVO_INDICE,
        conOyentes,
        // Crecer a ratos: no rehacemos los que ya están, así cada corrida avanza.
        soloNuevos: true,
        presupuestoMs: restante(),
        log,
      });
      const previo = total;
      total = await prisma.canonAlbum.count();

      // Wikidata no dio ni uno nuevo teniendo tiempo de sobra: el índice llegó a
      // su techo (hay menos discos con ese nivel de documentación que el objetivo).
      // No es un fallo ni algo que repetir: se sigue con las portadas.
      const enSuTecho = !resumen.incompleta && resumen.nuevos === 0;
      if (!enSuTecho) {
        const sinPortada = await prisma.canonAlbum.count({ where: { coverUrl: null } });
        return {
          paso: "indice",
          mensaje:
            arrastre +
            (previo === 0
              ? `El Salón ya está en pie: entraron ${resumen.nuevos} discos al canon.`
              : `Entraron ${resumen.nuevos} discos más: el canon va por ${total}.`),
          quedaTrabajo: resumen.incompleta || total < OBJETIVO_INDICE || sinPortada > 0,
          total,
          sinPortada,
        };
      }
      arrastre += `El canon está completo con ${total} discos. `;
    } catch (err) {
      // Antes esto tumbaba la corrida entera y el botón no hacía NADA: con el
      // índice a medias y Wikidata sin responder había cientos de carátulas
      // esperando y ni se llegaba a mirarlas. Ahora se anota y se sigue.
      fallo = (err as Error).message;
      log(`⚠ El índice no pudo crecer: ${fallo}`);
      total = await prisma.canonAlbum.count();
    }
  }

  // 2. Con el canon en pie, lo que falta son caras: las portadas.
  if ((await prisma.canonAlbum.count({ where: { coverUrl: null } })) > 0) {
    const puestas = await rellenarPortadas(300, log, restante());
    const sinPortada = await prisma.canonAlbum.count({ where: { coverUrl: null } });
    return {
      paso: "portadas",
      mensaje: fallo
        ? `${arrastre}${fallo}, así que el canon no creció esta vez. Mientras ` +
          `tanto busqué carátulas: ${puestas} nuevas, faltan ${sinPortada}.`
        : `${arrastre}${puestas} carátulas nuevas. Faltan ${sinPortada} por buscar.`,
      quedaTrabajo: sinPortada > 0 || fallo !== null,
      total,
      sinPortada,
    };
  }

  // Wikidata falló y no había ninguna otra cosa que hacer: que se sepa. Este es
  // el único camino que sale por la puerta del error, y es el correcto — decir
  // "todo al día" con el canon a medio levantar sería mentirle al curador.
  //
  // Salvo que la corrida SÍ haya arreglado algo (los puntajes que faltaban):
  // entonces contarlo vale más que el error, porque es justo lo que el curador
  // vino a ver. Se dice todo: lo que se arregló y lo que sigue sin poder ser.
  if (fallo) {
    if (arrastre) {
      return {
        paso: "indice",
        mensaje: `${arrastre}El canon no creció esta vez (${fallo}).`,
        quedaTrabajo: true,
        total,
        sinPortada: 0,
      };
    }
    throw new Error(fallo);
  }

  return {
    paso: "al-dia",
    mensaje: `${arrastre}El Salón está al día: ${total} discos, todos con carátula.`,
    quedaTrabajo: false,
    total,
    sinPortada: 0,
  };
}
