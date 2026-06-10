// iTunes Search API: portada HD y link a Apple Music. Sin API key.

export type ItunesAlbum = {
  coverUrl: string | null;
  appleMusicUrl: string | null;
};

export async function searchAlbum(
  album: string,
  artist: string,
): Promise<ItunesAlbum> {
  const term = encodeURIComponent(`${artist} ${album}`);
  const res = await fetch(
    `https://itunes.apple.com/search?term=${term}&entity=album&limit=5`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!res.ok) return { coverUrl: null, appleMusicUrl: null };
  const data = (await res.json()) as {
    results: {
      collectionName?: string;
      artworkUrl100?: string;
      collectionViewUrl?: string;
    }[];
  };
  const match =
    data.results.find((r) =>
      r.collectionName?.toLowerCase().includes(album.toLowerCase()),
    ) ?? data.results[0];
  if (!match) return { coverUrl: null, appleMusicUrl: null };
  return {
    coverUrl: match.artworkUrl100?.replace("100x100", "600x600") ?? null,
    appleMusicUrl: match.collectionViewUrl ?? null,
  };
}
