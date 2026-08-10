// Cliente de Wikidata (Fase 9 — el Salón de la Fama).
//
// Es la fuente del ÍNDICE del canon: de aquí sale qué discos entran y las dos
// señales duras que más pesan en su puntaje (en cuántas ediciones de Wikipedia
// tiene artículo propio, y qué premios recibió). Datos libres (CC0), sin API
// key y sin scraping: se consulta el endpoint SPARQL oficial.
//
// Nada de lo que devuelve pasa por un LLM. Si Wikidata no responde, la ingesta
// lo dice y no inventa nada.

const SPARQL = "https://query.wikidata.org/sparql";
const USER_AGENT =
  "Musicart/1.0 (app de curaduría musical; índice del canon) node-fetch";

/** Ejecuta una consulta SPARQL. POST porque las consultas son largas. */
async function sparql<T>(query: string, timeoutMs = 90_000): Promise<T> {
  const res = await fetch(SPARQL, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ query }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const detalle = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`Wikidata ${res.status}: ${detalle}`);
  }
  return (await res.json()) as T;
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

// Los discos más documentados del mundo, ordenados por número de ediciones de
// Wikipedia que les dedican un artículo propio.
//
// El filtro por `sitelinks` va PRIMERO y no es cosmético: sin él, la consulta
// tendría que ordenar cientos de miles de álbumes y el endpoint la corta por
// tiempo. Con el filtro, el universo baja a unos pocos miles.
const CONSULTA_CANDIDATOS = (minSitelinks: number, limite: number) => `
SELECT ?album ?albumLabel ?artistLabel ?date ?sitelinks ?countryCode ?mbid WHERE {
  ?album wdt:P31 wd:Q482994 ;
         wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${minSitelinks})
  ?album wdt:P175 ?artist .
  OPTIONAL { ?album wdt:P577 ?date . }
  OPTIONAL { ?album wdt:P436 ?mbid . }
  OPTIONAL { ?artist wdt:P27 ?country . ?country wdt:P297 ?countryCode . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en" . }
}
ORDER BY DESC(?sitelinks)
LIMIT ${limite}
`;

/**
 * Trae los candidatos al índice del canon.
 *
 * Pide de más (`limite * 3`) porque una misma obra vuelve repetida cuando tiene
 * varios intérpretes o el artista tiene doble nacionalidad; deduplicamos aquí y
 * nos quedamos con `limite` discos distintos.
 */
export async function buscarAlbumesCanonicos(
  limite = 1000,
  minSitelinks = 15,
): Promise<WdCandidato[]> {
  const data = await sparql<SparqlResult>(
    CONSULTA_CANDIDATOS(minSitelinks, limite * 3),
  );
  const filas = data.results?.bindings ?? [];

  const porId = new Map<string, WdCandidato>();
  for (const fila of filas) {
    const id = qid(fila.album?.value);
    const title = etiquetaUtil(fila.albumLabel?.value);
    const artist = etiquetaUtil(fila.artistLabel?.value);
    if (!id || !title || !artist) continue;

    const existente = porId.get(id);
    if (existente) {
      // Fila repetida: solo completamos lo que faltara (país, mbid).
      existente.country ??= fila.countryCode?.value?.toUpperCase() ?? null;
      existente.mbid ??= fila.mbid?.value ?? null;
      continue;
    }

    const anio = Number(fila.date?.value?.slice(0, 4));
    porId.set(id, {
      wikidataId: id,
      title,
      artist,
      year: Number.isFinite(anio) && anio > 1900 ? anio : null,
      sitelinks: Number(fila.sitelinks?.value) || 0,
      country: fila.countryCode?.value?.toUpperCase() ?? null,
      mbid: fila.mbid?.value ?? null,
    });
    if (porId.size >= limite) break;
  }

  return [...porId.values()];
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
  log: (msg: string) => void = () => {},
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();

  for (let i = 0; i < wikidataIds.length; i += tamLote) {
    const lote = wikidataIds.slice(i, i + tamLote);
    try {
      const data = await sparql<SparqlResult>(CONSULTA_PREMIOS(lote));
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
    await new Promise((r) => setTimeout(r, 1200));
  }

  return out;
}
