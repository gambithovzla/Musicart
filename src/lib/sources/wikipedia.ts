// Wikipedia (es con fallback a en): extractos de contexto histórico.

type WikiExtract = { title: string; text: string; url: string; lang: string };

async function searchAndExtract(
  lang: "es" | "en",
  query: string,
): Promise<WikiExtract | null> {
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  const searchRes = await fetch(
    `${api}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!searchRes.ok) return null;
  const search = (await searchRes.json()) as {
    query?: { search?: { title: string }[] };
  };
  const title = search.query?.search?.[0]?.title;
  if (!title) return null;

  const extractRes = await fetch(
    `${api}?action=query&prop=extracts&explaintext=1&exsectionformat=plain&titles=${encodeURIComponent(title)}&format=json&origin=*&exchars=6000`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!extractRes.ok) return null;
  const data = (await extractRes.json()) as {
    query?: { pages?: Record<string, { extract?: string }> };
  };
  const pages = Object.values(data.query?.pages ?? {});
  const text = pages[0]?.extract?.trim();
  if (!text) return null;

  return {
    title,
    text,
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    lang,
  };
}

// Busca el artículo del álbum: primero en español, luego en inglés.
export async function getAlbumContext(
  album: string,
  artist: string,
): Promise<WikiExtract | null> {
  return (
    (await searchAndExtract("es", `${album} álbum ${artist}`).catch(() => null)) ??
    (await searchAndExtract("en", `${album} album ${artist}`).catch(() => null))
  );
}

export async function getArtistContext(artist: string): Promise<WikiExtract | null> {
  return (
    (await searchAndExtract("es", artist).catch(() => null)) ??
    (await searchAndExtract("en", `${artist} musician`).catch(() => null))
  );
}
