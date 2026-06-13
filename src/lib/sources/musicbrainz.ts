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
