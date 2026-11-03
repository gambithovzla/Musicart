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

/**
 * LOS FRAGMENTOS DE 30 s, sacados de Deezer.
 *
 * Segunda fuente para «oír el disco dentro de la app»: iTunes no siempre tiene
 * el disco (o, peor, devuelve OTRO del mismo artista: buscar "Nothing But
 * Thieves Broken Machine" devolvía su primer álbum, así que las canciones no
 * emparejaban y el oyente se quedaba sin un solo botón). Deezer acierta más y
 * sus avances son MP3 de 30 s que suenan en cualquier navegador.
 *
 * Se busca el álbum por artista + título, se comprueba que el nombre sea de
 * verdad ese disco (ignorando «Deluxe», «Remastered» y compañía) y se piden sus
 * pistas. Si algo falla, [] — los fragmentos son un plus, nunca una dependencia.
 */
export async function getDeezerPreviews(
  album: string,
  artist: string,
): Promise<{ position: number; title: string; url: string }[]> {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\((?:[^)]*(deluxe|remaster|edici[oó]n|version|bonus)[^)]*)\)/gi, " ")
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const buscado = norm(album);
  try {
    const busq = await fetch(
      `https://api.deezer.com/search/album?q=${encodeURIComponent(`${artist} ${album}`)}&limit=10`,
      { signal: AbortSignal.timeout(8_000), next: { revalidate: 86_400 } },
    );
    if (!busq.ok) return [];
    const data = (await busq.json()) as {
      data?: { id?: number; title?: string; artist?: { name?: string } }[];
    };
    const candidatos = (data.data ?? []).filter((a) => a.id && a.title);
    // Primero el título exacto (normalizado), luego el que lo contenga; y que el
    // artista coincida, o nos arriesgamos a los avances de otro disco.
    const delArtista = candidatos.filter(
      (a) => norm(a.artist?.name ?? "").includes(norm(artist).split(" ")[0] ?? "") || norm(artist).includes(norm(a.artist?.name ?? "?")),
    );
    const elegido =
      delArtista.find((a) => norm(a.title!) === buscado) ??
      delArtista.find((a) => norm(a.title!).startsWith(buscado) || buscado.startsWith(norm(a.title!))) ??
      (delArtista.length === 1 ? delArtista[0] : undefined);
    if (!elegido?.id) return [];

    const pistas = await fetch(
      `https://api.deezer.com/album/${elegido.id}/tracks?limit=60`,
      { signal: AbortSignal.timeout(8_000), next: { revalidate: 86_400 } },
    );
    if (!pistas.ok) return [];
    const tracks = (await pistas.json()) as {
      data?: { title?: string; track_position?: number; preview?: string }[];
    };
    return (tracks.data ?? [])
      .filter((t) => t.preview && t.title)
      .map((t, i) => ({
        position: t.track_position ?? i + 1,
        title: t.title!,
        url: t.preview!,
      }))
      .sort((a, b) => a.position - b.position);
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
