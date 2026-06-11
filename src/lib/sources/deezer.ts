// Deezer Search API: sugerencias de artistas con foto. Pública, sin API key.
// Solo se usa para el autocompletado del onboarding (mostrar la cara del
// artista). Si falla, devuelve [] y el onboarding sigue funcionando a mano.

export type ArtistSuggestion = {
  name: string;
  image: string | null;
};

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
