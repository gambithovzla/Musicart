// Cliente de Wikidata (Fase 9 — el Salón de la Fama).
//
// Es la fuente del ÍNDICE del canon: de aquí sale qué discos entran y las dos
// señales duras que más pesan en su puntaje (en cuántas ediciones de Wikipedia
// tiene artículo propio, y qué premios recibió). Datos libres (CC0), sin API
// key y sin scraping: se consulta el endpoint SPARQL oficial.
//
// Nada de lo que devuelve pasa por un LLM. Si Wikidata no responde, la ingesta
// lo dice y no inventa nada.
//
// ── Por qué está partido en trozos ───────────────────────────────────────────
// El endpoint es público, gratuito y compartido con todo el mundo, y se corta a
// sí mismo a los 60 segundos. Una sola consulta que recorra TODOS los álbumes
// del planeta, los ordene y devuelva miles de filas con sus etiquetas roza ese
// techo: unas veces entra y otras el nginx de delante contesta «502 Bad
// Gateway». Eso es exactamente lo que veía el curador al pulsar «Levantarlo
// ahora».
//
// La cura es no pedir nunca una consulta grande:
//   · la búsqueda va por TRAMOS de documentación (≥90 sitelinks, 60-90, 45-60…),
//     de más canónico a menos, así ninguna petición se acerca al minuto;
//   · el país del artista se pregunta aparte y en lotes, porque era un rodeo de
//     dos saltos que además duplicaba filas (artistas con doble nacionalidad);
//   · todo reintenta con esperas crecientes, porque un 502 casi siempre es un
//     bache de segundos;
//   · si un tramo se cae del todo, se pierde ese tramo y no el índice entero.

const SPARQL = "https://query.wikidata.org/sparql";
const USER_AGENT =
  "Musicart/1.0 (app de curaduría musical; índice del canon) node-fetch";

/** WDQS se corta solo al minuto: esperar más es esperar a un muerto. */
const TIMEOUT_MS = 60_000;

/** Esperas entre reintentos. Tres intentos en total por consulta. */
const ESPERAS_MS = [4_000, 12_000];

/** Cortesía con un endpoint público: nunca dos peticiones seguidas. */
const PAUSA_MS = 900;

/**
 * Con menos margen que esto no se pregunta: no daría tiempo ni a la respuesta,
 * y una petición que sabemos que vamos a abandonar es trabajo que le regalamos
 * al endpoint para nada.
 */
const MARGEN_MINIMO_MS = 6_000;

type OpcionesRed = {
  /**
   * Instante (epoch ms) pasado el cual no se pide ni se reintenta más. Existe
   * para las corridas desde la web, que tienen el reloj de Vercel encima: al
   * agotarse devolvemos lo que se haya podido traer en vez de que nos corten.
   */
  deadline?: number;
  log?: (msg: string) => void;
};

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** ¿Queda tiempo para una pregunta más? */
const sinMargen = (deadline?: number) =>
  deadline !== undefined && deadline - Date.now() < MARGEN_MINIMO_MS;

/** Fallo pasajero (5xx, 429, corte de red): reintentar tiene sentido. */
class ErrorPasajero extends Error {
  constructor(
    mensaje: string,
    readonly esperaMs: number | null = null,
  ) {
    super(mensaje);
  }
}

/** La consulta está mal escrita: reintentarla da exactamente lo mismo. */
class ErrorDeConsulta extends Error {}

// Traducción de los estados que de verdad devuelve este endpoint. Sin esto, el
// cuerpo de un 502 (la página de nginx entera, con sus <html> y su <center>)
// acababa pegado tal cual en la pantalla del curador.
const EXPLICACION: Record<number, string> = {
  429: "nos está frenando por pedir demasiado seguido",
  500: "no pudo con la consulta",
  502: "no respondió (su servidor está saturado)",
  503: "está en mantenimiento o saturado",
  504: "tardó demasiado en responder",
};

function motivo(status: number, cuerpo: string): string {
  const conocido = EXPLICACION[status];
  if (conocido) return `Wikidata ${status}: ${conocido}`;
  const texto = cuerpo
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  return texto ? `Wikidata ${status}: ${texto}` : `Wikidata ${status}`;
}

function esperaSugerida(res: Response): number | null {
  const cabecera = res.headers.get("retry-after");
  const segundos = Number(cabecera);
  if (!Number.isFinite(segundos) || segundos <= 0) return null;
  // Un Retry-After de diez minutos no lo vamos a esperar: preferimos rendirnos
  // y que la siguiente corrida lo intente.
  return Math.min(segundos * 1000, 30_000);
}

/** Un intento contra el endpoint. Clasifica el fallo; no reintenta. */
async function unaVez<T>(query: string, timeoutMs: number): Promise<T> {
  let res: Response;
  try {
    res = await fetch(SPARQL, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ query }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const causa =
      (err as Error).name === "TimeoutError"
        ? `no respondió en ${Math.round(timeoutMs / 1000)}s`
        : "cortó la conexión";
    throw new ErrorPasajero(`Wikidata ${causa}`);
  }

  if (res.ok) {
    try {
      return (await res.json()) as T;
    } catch {
      // Un 200 que no trae JSON es el endpoint devolviendo una página (pasa
      // cuando está entrando en mantenimiento): pasajero, no consulta mala.
      throw new ErrorPasajero("Wikidata contestó algo que no son datos");
    }
  }

  const cuerpo = (await res.text().catch(() => "")).slice(0, 500);
  const mensaje = motivo(res.status, cuerpo);
  if (res.status < 500 && res.status !== 429) throw new ErrorDeConsulta(mensaje);
  throw new ErrorPasajero(mensaje, esperaSugerida(res));
}

/**
 * Ejecuta una consulta SPARQL con reintentos. POST porque las consultas son
 * largas. Un 502 aislado ya no tumba nada: se espera y se vuelve a preguntar.
 */
async function sparql<T>(query: string, opciones: OpcionesRed = {}): Promise<T> {
  const { deadline, log = () => {} } = opciones;
  // Es el único error posible si el bucle termina sin haber preguntado nunca, y
  // conviene que lo diga con esas palabras: quedarse sin reloj no es lo mismo
  // que una caída de Wikidata, y arriba se decide distinto según cuál sea.
  let ultimo: Error = new Error(
    "Se acabó el tiempo de esta corrida antes de preguntarle a Wikidata",
  );

  for (let intento = 0; ; intento++) {
    const margen = deadline === undefined ? TIMEOUT_MS : deadline - Date.now();
    if (margen < MARGEN_MINIMO_MS) break;

    try {
      return await unaVez<T>(query, Math.min(TIMEOUT_MS, margen));
    } catch (err) {
      if (err instanceof ErrorDeConsulta) throw err;
      ultimo = err as Error;
      if (intento >= ESPERAS_MS.length) break;

      const espera = Math.max(
        ESPERAS_MS[intento],
        err instanceof ErrorPasajero ? (err.esperaMs ?? 0) : 0,
      );
      // No dormir para despertarse ya sin tiempo de preguntar.
      if (sinMargen(deadline === undefined ? undefined : deadline - espera)) break;
      log(`⚠ ${ultimo.message}. Reintento en ${Math.round(espera / 1000)}s…`);
      await dormir(espera);
    }
  }

  throw ultimo;
}

type Binding = Record<string, { value: string } | undefined>;
type SparqlResult = { results?: { bindings?: Binding[] } };

/** "http://www.wikidata.org/entity/Q42" → "Q42" */
function qid(uri: string | undefined): string | null {
  if (!uri) return null;
  const m = uri.match(/\/(Q\d+)$/);
  return m ? m[1] : null;
}

/**
 * Una etiqueta sin traducir vuelve como el propio QID. Eso no es un nombre,
 * es un identificador: mejor descartar el disco que meter "Q1065414" al índice.
 */
function etiquetaUtil(v: string | undefined): string | null {
  const s = v?.trim();
  if (!s || /^Q\d+$/.test(s)) return null;
  return s;
}

export type WdCandidato = {
  wikidataId: string;
  title: string;
  artist: string;
  year: number | null;
  sitelinks: number;
  /** Código ISO-3166-1 alfa-2 de la nacionalidad del artista, si consta. */
  country: string | null;
  /** Release group de MusicBrainz (P436), si Wikidata lo tiene enlazado. */
  mbid: string | null;
};

// Los discos más documentados del mundo, por tramo de documentación.
//
// El filtro por `sitelinks` no es cosmético: sin él la consulta tendría que
// mirar cientos de miles de álbumes. Y el tramo (un suelo Y un techo) es lo que
// mantiene cada petición pequeña: el trabajo total es parecido al de la consulta
// grande de antes, pero repartido en peticiones que ninguna se acerca al minuto
// que aguanta el endpoint.
//
// Sin ORDER BY a propósito: dentro de un tramo todos los discos están igual de
// documentados, así que ordenarlos costaba tiempo sin cambiar nada. El orden
// canónico lo da el recorrido de los tramos, de arriba abajo.
const CONSULTA_CANDIDATOS = (
  desde: number,
  hasta: number | null,
  limite: number,
) => `
SELECT ?album ?albumLabel ?artist ?artistLabel ?date ?sitelinks ?mbid WHERE {
  ?album wdt:P31 wd:Q482994 ;
         wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${desde}${hasta !== null ? ` && ?sitelinks < ${hasta}` : ""})
  ?album wdt:P175 ?artist .
  OPTIONAL { ?album wdt:P577 ?date . }
  OPTIONAL { ?album wdt:P436 ?mbid . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en" . }
}
LIMIT ${limite}
`;

/** Cortes de los tramos, de más documentado a menos. */
const CORTES = [90, 60, 45, 35, 28, 23, 19, 16];

function tramos(minSitelinks: number): { desde: number; hasta: number | null }[] {
  const lista: { desde: number; hasta: number | null }[] = [];
  let techo: number | null = null;
  for (const corte of CORTES.filter((c) => c > minSitelinks)) {
    lista.push({ desde: corte, hasta: techo });
    techo = corte;
  }
  lista.push({ desde: minSitelinks, hasta: techo });
  return lista;
}

/**
 * Trae los candidatos al índice del canon, tramo a tramo y de más canónico a
 * menos. Si un tramo se cae después de reintentar, se salta y se sigue: un
 * índice al que le falta una franja es infinitamente mejor que ningún índice.
 * Solo se da por perdida la búsqueda si NINGÚN tramo respondió.
 *
 * Pide de más (`limite * 1.5`) porque una misma obra vuelve repetida cuando
 * tiene varios intérpretes o varias fechas de publicación (reediciones);
 * deduplicamos aquí y nos quedamos con `limite` discos distintos.
 */
export async function buscarAlbumesCanonicos(
  limite = 1000,
  minSitelinks = 15,
  opciones: OpcionesRed = {},
): Promise<WdCandidato[]> {
  const { deadline, log = () => {} } = opciones;
  const porId = new Map<string, WdCandidato>();
  const artistaDe = new Map<string, string>(); // álbum → artista (para el país)

  let tramosOk = 0;
  let ultimoFallo: Error | null = null;

  for (const tramo of tramos(minSitelinks)) {
    if (porId.size >= limite) break;
    if (sinMargen(deadline)) {
      log("Se acabó el tiempo de búsqueda: seguimos con lo que ya entró.");
      break;
    }

    const rotulo =
      tramo.hasta === null
        ? `≥${tramo.desde}`
        : `${tramo.desde}-${tramo.hasta - 1}`;
    const pedir = Math.min(1500, Math.ceil((limite - porId.size) * 1.5) + 50);

    let filas: Binding[];
    try {
      const data = await sparql<SparqlResult>(
        CONSULTA_CANDIDATOS(tramo.desde, tramo.hasta, pedir),
        opciones,
      );
      filas = data.results?.bindings ?? [];
      tramosOk++;
    } catch (err) {
      ultimoFallo = err as Error;
      log(`⚠ Tramo de ${rotulo} ediciones no vino: ${ultimoFallo.message}`);
      continue;
    }

    for (const fila of filas) {
      const id = qid(fila.album?.value);
      const title = etiquetaUtil(fila.albumLabel?.value);
      const artist = etiquetaUtil(fila.artistLabel?.value);
      if (!id || !title || !artist) continue;

      const anio = Number(fila.date?.value?.slice(0, 4));
      const anioUtil = Number.isFinite(anio) && anio > 1900 ? anio : null;

      const existente = porId.get(id);
      if (existente) {
        // Fila repetida: completamos lo que faltara y nos quedamos con la fecha
        // más antigua, que es la de la edición original y no la de una reedición.
        existente.mbid ??= fila.mbid?.value ?? null;
        if (anioUtil && (!existente.year || anioUtil < existente.year)) {
          existente.year = anioUtil;
        }
        continue;
      }

      porId.set(id, {
        wikidataId: id,
        title,
        artist,
        year: anioUtil,
        sitelinks: Number(fila.sitelinks?.value) || 0,
        country: null, // se rellena abajo, en lotes
        mbid: fila.mbid?.value ?? null,
      });
      const artistaId = qid(fila.artist?.value);
      if (artistaId) artistaDe.set(id, artistaId);
      if (porId.size >= limite) break;
    }

    log(`Tramo de ${rotulo} ediciones: el canon va por ${porId.size} discos.`);
    await dormir(PAUSA_MS);
  }

  // Ningún tramo respondió: eso no es "no hay discos", es "Wikidata está caída"
  // (o "no hubo tiempo ni de empezar"). Hay que decirlo con el motivo real y no
  // devolver una lista vacía, que arriba se confundiría con un índice
  // legítimamente vacío. Si algún tramo SÍ entró, devolvemos lo que haya: media
  // franja del canon vale más que un error.
  if (tramosOk === 0) {
    throw (
      ultimoFallo ??
      new Error("No hubo tiempo de preguntarle nada a Wikidata en esta corrida")
    );
  }

  const candidatos = [...porId.values()];
  await ponerPaises(candidatos, artistaDe, opciones);
  return candidatos;
}

const CONSULTA_PAISES = (ids: string[]) => `
SELECT ?artist ?countryCode WHERE {
  VALUES ?artist { ${ids.map((id) => `wd:${id}`).join(" ")} }
  ?artist wdt:P27/wdt:P297 ?countryCode .
}
`;

/**
 * Nacionalidad de los artistas, en lotes y por separado.
 *
 * Iba dentro de la consulta principal y era mala idea: son dos saltos más por
 * fila (artista → país → código) y encima duplicaba filas de los artistas con
 * doble nacionalidad, o sea que engordaba justo la consulta que se estaba
 * atragantando. Aquí es una pregunta corta y suya; si falla, el canon se queda
 * sin banderitas y no pasa nada más.
 */
async function ponerPaises(
  candidatos: WdCandidato[],
  artistaDe: Map<string, string>,
  opciones: OpcionesRed = {},
): Promise<void> {
  const { deadline, log = () => {} } = opciones;
  const ids = [...new Set(artistaDe.values())];
  const porArtista = new Map<string, string>();

  for (let i = 0; i < ids.length; i += 300) {
    if (sinMargen(deadline)) {
      log("Se acabó el tiempo para los países: los pone la siguiente corrida.");
      break;
    }
    const lote = ids.slice(i, i + 300);
    try {
      const data = await sparql<SparqlResult>(CONSULTA_PAISES(lote), opciones);
      for (const fila of data.results?.bindings ?? []) {
        const artista = qid(fila.artist?.value);
        const codigo = fila.countryCode?.value?.toUpperCase();
        // Doble nacionalidad: nos quedamos con la primera que llegue.
        if (artista && codigo && !porArtista.has(artista)) {
          porArtista.set(artista, codigo);
        }
      }
    } catch (err) {
      log(`⚠ Lote de países ${i}-${i + lote.length} falló: ${(err as Error).message}`);
    }
    await dormir(PAUSA_MS);
  }

  for (const c of candidatos) {
    const artista = artistaDe.get(c.wikidataId);
    c.country = (artista && porArtista.get(artista)) ?? null;
  }
}

const CONSULTA_PREMIOS = (ids: string[]) => `
SELECT ?album ?awardLabel WHERE {
  VALUES ?album { ${ids.map((id) => `wd:${id}`).join(" ")} }
  ?album wdt:P166 ?award .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
`;

/**
 * Premios por disco, en lotes. Devuelve las ETIQUETAS en inglés a propósito:
 * son las que reconoce la tabla de pesos de `score.ts` ("Album of the Year",
 * "National Recording Registry") y no dependen de que exista traducción.
 *
 * Si un lote falla, se salta: quedarse sin el dato de premios de 200 discos es
 * mucho mejor que quedarse sin índice.
 */
export async function premiosDeAlbumes(
  wikidataIds: string[],
  tamLote = 200,
  opciones: OpcionesRed = {},
): Promise<Map<string, string[]>> {
  const { deadline, log = () => {} } = opciones;
  const out = new Map<string, string[]>();

  for (let i = 0; i < wikidataIds.length; i += tamLote) {
    if (sinMargen(deadline)) {
      log("Se acabó el tiempo para los premios: los añade la siguiente corrida.");
      break;
    }
    const lote = wikidataIds.slice(i, i + tamLote);
    try {
      const data = await sparql<SparqlResult>(CONSULTA_PREMIOS(lote), opciones);
      for (const fila of data.results?.bindings ?? []) {
        const id = qid(fila.album?.value);
        const premio = etiquetaUtil(fila.awardLabel?.value);
        if (!id || !premio) continue;
        const lista = out.get(id) ?? [];
        if (!lista.includes(premio)) lista.push(premio);
        out.set(id, lista);
      }
    } catch (err) {
      log(`⚠ Lote de premios ${i}-${i + lote.length} falló: ${(err as Error).message}`);
    }
    // Cortesía con el endpoint público: es gratis y de todos.
    await dormir(1200);
  }

  return out;
}
