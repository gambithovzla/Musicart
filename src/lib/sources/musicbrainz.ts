// Cliente de MusicBrainz: metadata canónica (álbum, fecha, tracklist, sello).
// Sin API key. Etiqueta: máx 1 request/segundo y User-Agent identificable.

const BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "Musicart/0.1 (app de curaduría musical; dev local)";

// Cola simple para respetar el rate limit de 1 req/s.
let lastCall = Promise.resolve();
function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
  const next = lastCall.then(
    () => new Promise((r) => setTimeout(r, 1100)),
  ).then(fn);
  lastCall = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function mb<T>(path: string): Promise<T> {
  return rateLimited(async () => {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`MusicBrainz ${res.status}: ${path}`);
    return (await res.json()) as T;
  });
}

export type MbReleaseGroup = {
  id: string;
  title: string;
  artistName: string;
  artistMbid?: string;
  firstReleaseDate?: string; // YYYY-MM-DD o YYYY
};

export async function searchReleaseGroup(
  album: string,
  artist: string,
): Promise<MbReleaseGroup | null> {
  const query = encodeURIComponent(
    `releasegroup:"${album}" AND artist:"${artist}" AND primarytype:album`,
  );
  const data = await mb<{
    "release-groups": {
      id: string;
      title: string;
      score: number;
      "first-release-date"?: string;
      "artist-credit"?: { name: string; artist: { id: string; name: string } }[];
    }[];
  }>(`/release-group/?query=${query}&fmt=json&limit=5`);

  const best = data["release-groups"]?.[0];
  if (!best || best.score < 70) return null;
  return {
    id: best.id,
    title: best.title,
    artistName: best["artist-credit"]?.[0]?.artist.name ?? artist,
    artistMbid: best["artist-credit"]?.[0]?.artist.id,
    firstReleaseDate: best["first-release-date"],
  };
}

export type MbConnection = {
  kind: "sample" | "remix";
  track: string; // canción de ESTE álbum
  relatedTitle: string; // canción relacionada
  relatedArtist?: string; // artista de la canción relacionada
  direction: "uses" | "usedBy"; // esta canción usa la otra, o fue usada por la otra
};

export type MbAlbumDetails = {
  label?: string;
  tracklist: { position: number; title: string; lengthMs?: number }[];
  durationMin?: number;
  connections: MbConnection[]; // samples/remixes verificados (la madriguera)
};

type MbRelation = {
  type?: string;
  direction?: string;
  recording?: {
    title?: string;
    "artist-credit"?: { name?: string; artist?: { name?: string } }[];
  };
};

function artistName(
  credit?: { name?: string; artist?: { name?: string } }[],
): string | undefined {
  if (!credit?.length) return undefined;
  const joined = credit.map((c) => c.name ?? c.artist?.name ?? "").join("").trim();
  return joined || undefined;
}

// Extrae samples y remixes de las relaciones de cada grabación (la materia
// prima de la madriguera). Solo relaciones que MusicBrainz da como datos duros.
function parseConnections(
  media: { tracks?: { title: string; recording?: { relations?: MbRelation[] } }[] }[],
): MbConnection[] {
  const out: MbConnection[] = [];
  for (const m of media ?? []) {
    for (const t of m.tracks ?? []) {
      for (const rel of t.recording?.relations ?? []) {
        const kind =
          rel.type === "samples material"
            ? "sample"
            : rel.type === "remix" || rel.type === "remixes"
              ? "remix"
              : null;
        if (!kind || !rel.recording?.title) continue;
        out.push({
          kind,
          track: t.title,
          relatedTitle: rel.recording.title,
          relatedArtist: artistName(rel.recording["artist-credit"]),
          direction: rel.direction === "backward" ? "usedBy" : "uses",
        });
        if (out.length >= 12) return out; // tope: no inflar el payload
      }
    }
  }
  return out;
}

export async function getAlbumDetails(
  releaseGroupMbid: string,
): Promise<MbAlbumDetails | null> {
  // 1. Releases del release-group → elegir la edición oficial más antigua.
  const rg = await mb<{
    releases: { id: string; status?: string; date?: string; country?: string }[];
  }>(`/release-group/${releaseGroupMbid}?fmt=json&inc=releases`);

  const official = (rg.releases ?? [])
    .filter((r) => !r.status || r.status === "Official")
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const release = official[0] ?? rg.releases?.[0];
  if (!release) return null;

  // 2. Tracklist, sello y relaciones (samples/remixes) de esa edición.
  //    `recording-level-rels` trae las relaciones de cada grabación en la misma
  //    llamada — sin pedir una request por canción (respeta el rate limit).
  const rel = await mb<{
    media?: {
      tracks?: {
        position: number;
        title: string;
        length?: number;
        recording?: { relations?: MbRelation[] };
      }[];
    }[];
    "label-info"?: { label?: { name?: string } }[];
  }>(
    `/release/${release.id}?fmt=json&inc=recordings+labels+recording-level-rels+artist-credits`,
  );

  const tracks = (rel.media ?? []).flatMap((m, mi) =>
    (m.tracks ?? []).map((t) => ({
      position: mi * 100 + t.position, // soporta multi-disco sin colisiones
      title: t.title,
      lengthMs: t.length,
    })),
  );
  // Normalizar posiciones a 1..n
  const tracklist = tracks
    .sort((a, b) => a.position - b.position)
    .map((t, i) => ({ position: i + 1, title: t.title, lengthMs: t.lengthMs }));

  const totalMs = tracklist.reduce((sum, t) => sum + (t.lengthMs ?? 0), 0);
  return {
    label: rel["label-info"]?.[0]?.label?.name,
    tracklist,
    durationMin: totalMs > 0 ? Math.round(totalMs / 60_000) : undefined,
    connections: parseConnections(rel.media ?? []),
  };
}

export type MbArtistOrigin = {
  /** Nombre del artista tal cual lo guarda MusicBrainz. */
  name: string;
  /** Código ISO del país (VE, US, GB…). MusicBrainz no siempre lo tiene. */
  country: string | null;
  /** Área actual (país o región) — respaldo cuando no hay código de país. */
  areaName: string | null;
  /** Área de origen (dónde nació/se formó) — el dato más fiel al "de dónde es". */
  beginAreaName: string | null;
};

/**
 * De dónde es un artista, según MusicBrainz. Lo usa la barrera de origen
 * (`src/lib/origin-guard.ts`) cuando el oyente pide artistas de un país:
 * comprobarlo con datos duros es mucho más fiable que preguntárselo al LLM.
 */
export async function searchArtistOrigin(
  artist: string,
): Promise<MbArtistOrigin | null> {
  // Comillas y símbolos de Lucene romperían la consulta (los nombres de banda
  // traen de todo): los quitamos antes de armarla.
  const limpio = artist.replace(/["\\/:^~*?!(){}\[\]]/g, " ").replace(/\s+/g, " ").trim();
  if (!limpio) return null;
  const query = encodeURIComponent(`artist:"${limpio}"`);
  const data = await mb<{
    artists?: {
      name: string;
      score: number;
      country?: string;
      area?: { name?: string };
      "begin-area"?: { name?: string };
    }[];
  }>(`/artist/?query=${query}&fmt=json&limit=5`);

  const artists = data.artists ?? [];
  if (artists.length === 0) return null;

  // Preferimos la coincidencia exacta de nombre; si no la hay, la de mejor score.
  const plano = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const objetivo = plano(artist);
  const best =
    artists.find((a) => plano(a.name) === objetivo) ??
    (artists[0].score >= 80 ? artists[0] : null);
  if (!best) return null;

  return {
    name: best.name,
    country: best.country ?? null,
    areaName: best.area?.name ?? null,
    beginAreaName: best["begin-area"]?.name ?? null,
  };
}

export type MbArtistaDePais = {
  name: string;
  /** Área de origen o país, para enseñárselo al curador junto al nombre. */
  area: string | null;
  /** Etiquetas de género que MusicBrainz le pone (las 3 con más votos). */
  tags: string[];
};

/**
 * Artistas REALES de un país, opcionalmente filtrados por género (etiqueta).
 *
 * Por qué existe: cuando el oyente pide "rock venezolano", la barrera de origen
 * sabe RECHAZAR lo que no es venezolano, pero nadie le dice al curador quién SÍ
 * lo es — y el LLM, puesto a recordar una escena poco documentada, gravita a los
 * famosos de al lado (Café Tacvba es mexicano, Juan Luis Guerra dominicano). Con
 * esta lista dejamos de fiar el "quién" a su memoria: MusicBrainz sí sabe qué
 * artistas son de Venezuela y llevan la etiqueta rock.
 *
 * Ante cualquier fallo devuelve [] y el curador sigue proponiendo como siempre.
 */
export async function artistasDePais(
  country: string,
  tags: string[] = [],
  limite = 30,
): Promise<MbArtistaDePais[]> {
  const code = country.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return [];

  const limpiarTag = (t: string) =>
    t.toLowerCase().replace(/["\\/:^~*?!(){}\[\]]/g, " ").replace(/\s+/g, " ").trim();
  const partes = [`country:${code}`];
  for (const t of tags.map(limpiarTag).filter(Boolean).slice(0, 2)) {
    partes.push(`tag:"${t}"`);
  }

  const consultar = async (query: string): Promise<MbArtistaDePais[]> => {
    const data = await mb<{
      artists?: {
        name: string;
        score: number;
        country?: string;
        area?: { name?: string };
        "begin-area"?: { name?: string };
        tags?: { count?: number; name?: string }[];
      }[];
    }>(`/artist/?query=${encodeURIComponent(query)}&fmt=json&limit=100`);

    return (data.artists ?? [])
      .filter((a) => a.name?.trim())
      // La consulta ya pide ese país; esto solo descarta a los vecinos que la
      // búsqueda difusa cuela con puntaje alto. Si el artista no trae código de
      // país (MusicBrainz lo deja vacío a menudo y solo guarda el área), lo
      // dejamos: la barrera de origen lo comprueba igual antes de fabricar.
      .filter((a) => !a.country || a.country.toUpperCase() === code)
      .map((a) => ({
        name: a.name.trim(),
        area: a["begin-area"]?.name ?? a.area?.name ?? null,
        tags: (a.tags ?? [])
          .slice()
          .sort((x, y) => (y.count ?? 0) - (x.count ?? 0))
          .map((t) => t.name?.trim())
          .filter((t): t is string => Boolean(t))
          .slice(0, 3),
        // Proxy de "conocido": en MusicBrainz, a los artistas que le importan a
        // alguien los etiqueta gente. No es popularidad, pero ordena mejor que
        // el alfabeto y saca a flote a los históricos de la escena.
        peso: (a.tags ?? []).reduce((n, t) => n + (t.count ?? 0), 0) + (a.score ?? 0) / 100,
      }))
      .sort((a, b) => b.peso - a.peso)
      .slice(0, limite)
      .map(({ name, area, tags: etiquetas }) => ({ name, area, tags: etiquetas }));
  };

  try {
    const conGenero = await consultar(partes.join(" AND "));
    // Con género hay escenas que dan poquísimo (el género se etiqueta a mano y
    // los países pequeños salen mal parados). Si apenas hay nombres, pedimos el
    // país entero: mejor un artista real de ahí que ninguno. Quien llama sabe
    // que la lista es de país y no de género (se lo decimos en el prompt).
    if (conGenero.length >= 6 || partes.length === 1) return conGenero;
    const soloPais = await consultar(`country:${code}`);
    const vistos = new Set(conGenero.map((a) => a.name.toLowerCase()));
    return [...conGenero, ...soloPais.filter((a) => !vistos.has(a.name.toLowerCase()))].slice(
      0,
      limite,
    );
  } catch (err) {
    console.warn("[musicbrainz] no pude listar artistas del país:", err);
    return [];
  }
}

// Conexiones a nivel ARTISTA (colaboraciones, bandas, fundadores…): la materia
// prima de los saltos de descubrimiento entre artistas. Datos estructurados de
// MusicBrainz, con su etiqueta → verificables.
export type MbArtistConnection = {
  relatedArtist: string;
  label: string; // etiqueta en español del tipo de vínculo
};

const TIPOS_ARTISTA: Record<string, string> = {
  collaboration: "colaboración",
  "member of band": "banda",
  founder: "fundador/a",
  "supporting musician": "músico de apoyo",
  "instrumental supporting musician": "músico de apoyo",
  "vocal supporting musician": "voz de apoyo",
  sibling: "vínculo familiar",
  parent: "vínculo familiar",
  married: "vínculo personal",
  "involved with": "vínculo personal",
  teacher: "maestro/discípulo",
  tribute: "tributo",
};

export async function getArtistConnections(
  artistMbid: string,
): Promise<MbArtistConnection[]> {
  const data = await mb<{
    relations?: { type?: string; artist?: { name?: string } }[];
  }>(`/artist/${artistMbid}?fmt=json&inc=artist-rels`).catch(() => null);
  if (!data?.relations) return [];

  const out: MbArtistConnection[] = [];
  const vistos = new Set<string>();
  for (const r of data.relations) {
    const label = r.type ? TIPOS_ARTISTA[r.type] : undefined;
    const name = r.artist?.name?.trim();
    if (!label || !name) continue;
    const key = `${name}|${label}`;
    if (vistos.has(key)) continue;
    vistos.add(key);
    out.push({ relatedArtist: name, label });
    if (out.length >= 10) break;
  }
  return out;
}
