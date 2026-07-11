// Deezer Search API: sugerencias de artistas con foto. Pública, sin API key.
// Solo se usa para el autocompletado del onboarding (mostrar la cara del
// artista). Si falla, devuelve [] y el onboarding sigue funcionando a mano.

export type ArtistSuggestion = {
  name: string;
  image: string | null;
};

export type AlbumSuggestion = {
  title: string;
  artist: string;
  cover: string | null;
  year: number | null;
};

/**
 * Búsqueda de álbumes con portada para el buscador del curador (panel admin).
 * Devuelve título + artista + carátula para que el dueño elija visualmente qué
 * disco fabricar. Si Deezer falla, devuelve [] (el admin siempre puede escribir
 * a mano). No lleva año fiable: el pipeline lo determina con MusicBrainz.
 */
export async function searchAlbums(
  query: string,
  limit = 8,
): Promise<AlbumSuggestion[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(
      `https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=${limit}`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: {
        title?: string;
        cover_medium?: string;
        cover?: string;
        artist?: { name?: string };
      }[];
    };
    const vistos = new Set<string>();
    const out: AlbumSuggestion[] = [];
    for (const a of data.data ?? []) {
      const title = a.title?.trim();
      const artist = a.artist?.name?.trim();
      if (!title || !artist) continue;
      const key = `${title.toLowerCase()}::${artist.toLowerCase()}`;
      if (vistos.has(key)) continue;
      vistos.add(key);
      out.push({
        title,
        artist,
        cover: a.cover_medium || a.cover || null,
        year: null,
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

export async function searchArtists(
  query: string,
  limit = 6,
): Promise<ArtistSuggestion[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=${limit}`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: {
        name?: string;
        picture_medium?: string;
        picture?: string;
      }[];
    };
    const vistos = new Set<string>();
    const out: ArtistSuggestion[] = [];
    for (const a of data.data ?? []) {
      const name = a.name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (vistos.has(key)) continue;
      vistos.add(key);
      out.push({ name, image: a.picture_medium || a.picture || null });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}
