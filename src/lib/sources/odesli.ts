// Odesli (song.link): resuelve los links de todas las plataformas desde un solo link.
// Gratuito sin key (rate limit bajo) — siempre con fallback a links de búsqueda.

import type { AlbumLinks } from "../types";

export async function resolveLinks(sourceUrl: string): Promise<AlbumLinks | null> {
  try {
    const res = await fetch(
      `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(sourceUrl)}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      linksByPlatform?: Record<string, { url?: string }>;
    };
    const p = data.linksByPlatform ?? {};
    return {
      spotify: p.spotify?.url,
      appleMusic: p.appleMusic?.url,
      youtubeMusic: p.youtubeMusic?.url ?? p.youtube?.url,
    };
  } catch {
    return null;
  }
}

// Links de búsqueda que funcionan siempre, sin APIs.
export function searchLinks(album: string, artist: string): AlbumLinks {
  const q = encodeURIComponent(`${album} ${artist}`);
  return {
    spotify: `https://open.spotify.com/search/${q}/albums`,
    youtubeMusic: `https://music.youtube.com/search?q=${q}`,
  };
}
