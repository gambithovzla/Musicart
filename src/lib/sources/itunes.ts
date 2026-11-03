// iTunes Search API: portada HD, link a Apple Music y datos básicos del álbum.
// Sin API key. El lookup de pistas usa el collectionId.

export type ItunesAlbum = {
  coverUrl: string | null;
  appleMusicUrl: string | null;
  // Campos extra usados como fallback cuando MusicBrainz no encuentra el disco:
  collectionId: number | null;
  title: string | null;
  artist: string | null;
  year: number | null;
  trackCount: number | null;
  label: string | null;
};

export type ItunesTrack = {
  position: number;
  title: string;
};

/** ¿Es un sencillo o EP? (por el sufijo del título o por traer ≤3 pistas). */
export function esSingleOEp(
  collectionName?: string,
  trackCount?: number,
): boolean {
  if (collectionName && /-\s*(single|ep)\s*$/i.test(collectionName)) return true;
  if (typeof trackCount === "number" && trackCount <= 3) return true;
  return false;
}

export async function searchAlbum(
  album: string,
  artist: string,
): Promise<ItunesAlbum> {
  const term = encodeURIComponent(`${artist} ${album}`);
  const res = await fetch(
    `https://itunes.apple.com/search?term=${term}&entity=album&limit=5`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!res.ok)
    return {
      coverUrl: null,
      appleMusicUrl: null,
      collectionId: null,
      title: null,
      artist: null,
      year: null,
      trackCount: null,
      label: null,
    };
  const data = (await res.json()) as {
    results: {
      collectionId?: number;
      collectionName?: string;
      artistName?: string;
      artworkUrl100?: string;
      collectionViewUrl?: string;
      releaseDate?: string;
      trackCount?: number;
      copyright?: string;
    }[];
  };
  // Descartamos sencillos y EPs: Musicart recomienda ÁLBUMES completos. iTunes
  // los nombra "… - Single" / "… - EP" y traen pocas pistas.
  const albumes = (data.results ?? []).filter((r) => !esSingleOEp(r.collectionName, r.trackCount));

  // OJO: antes, si ningún nombre contenía el título, se cogía el PRIMER álbum
  // que devolviera iTunes (`?? albumes[0]`). Eso no es «el disco», es otro disco
  // del mismo artista: buscar "Nothing But Thieves Broken Machine" devuelve su
  // primer álbum, y con él llegaban una portada y unos avances que no eran los
  // del dossier. Ahora, si el título no coincide, se devuelve vacío y el que
  // llama decide (los fragmentos prueban Deezer; los hechos, otra fuente).
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\((?:[^)]*(deluxe|remaster|edici[oó]n|version|bonus|expanded)[^)]*)\)/gi, " ")
      .replace(/-\s*(deluxe|remaster(ed)?|single|ep)\b.*$/i, " ")
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const buscado = norm(album);
  const match =
    albumes.find((r) => r.collectionName && norm(r.collectionName) === buscado) ??
    albumes.find((r) => {
      const n = norm(r.collectionName ?? "");
      return n.length > 2 && buscado.length > 2 && (n.startsWith(buscado) || buscado.startsWith(n));
    });
  if (!match)
    return {
      coverUrl: null,
      appleMusicUrl: null,
      collectionId: null,
      title: null,
      artist: null,
      year: null,
      trackCount: null,
      label: null,
    };

  const year = match.releaseDate
    ? Number(match.releaseDate.slice(0, 4))
    : null;

  // El campo copyright suele venir como "℗ 1994 Sony Music..." — extraemos solo
  // el nombre del sello eliminando el año y el símbolo inicial.
  const label = match.copyright
    ? match.copyright.replace(/^[℗©]\s*\d{4}\s*/i, "").trim() || null
    : null;

  return {
    coverUrl: match.artworkUrl100?.replace("100x100", "600x600") ?? null,
    appleMusicUrl: match.collectionViewUrl ?? null,
    collectionId: match.collectionId ?? null,
    title: match.collectionName ?? null,
    artist: match.artistName ?? null,
    year,
    trackCount: match.trackCount ?? null,
    label,
  };
}

export type ItunesPreview = { position: number; title: string; url: string };

/** El collectionId sale del enlace de Apple Music: .../album/nombre/785227961 */
export function collectionIdDeEnlace(appleMusicUrl?: string | null): number | null {
  const m = appleMusicUrl?.match(/\/album\/(?:[^/?#]+\/)?(\d{5,})/);
  return m ? Number(m[1]) : null;
}

/**
 * Los avances de 30 s de cada canción (los da iTunes gratis y sin clave). Es lo
 * que deja oír el disco DENTRO de la app antes de saltar a Spotify. Devuelve []
 * si falla: los fragmentos son un plus, nunca una dependencia.
 */
export async function getItunesPreviews(collectionId: number): Promise<ItunesPreview[]> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&limit=60`,
      { signal: AbortSignal.timeout(8_000), next: { revalidate: 86_400 } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results: {
        wrapperType: string;
        trackNumber?: number;
        discNumber?: number;
        trackName?: string;
        previewUrl?: string;
      }[];
    };
    return data.results
      .filter((r) => r.wrapperType === "track" && r.trackName && r.previewUrl && (r.discNumber ?? 1) === 1)
      .map((r) => ({ position: r.trackNumber ?? 0, title: r.trackName!, url: r.previewUrl! }))
      .sort((a, b) => a.position - b.position);
  } catch {
    return [];
  }
}

/**
 * Obtiene el tracklist de un álbum de iTunes por su collectionId.
 * Devuelve [] si falla (no bloquea el pipeline).
 */
export async function getItunesTracklist(
  collectionId: number,
): Promise<ItunesTrack[]> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&limit=50`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results: { wrapperType: string; trackNumber?: number; trackName?: string }[];
    };
    return data.results
      .filter((r) => r.wrapperType === "track" && r.trackName)
      .map((r) => ({ position: r.trackNumber ?? 0, title: r.trackName! }))
      .sort((a, b) => a.position - b.position);
  } catch {
    return [];
  }
}
