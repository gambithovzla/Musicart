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
  const match =
    albumes.find((r) =>
      r.collectionName?.toLowerCase().includes(album.toLowerCase()),
    ) ?? albumes[0];
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
