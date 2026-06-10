// Last.fm: tags, popularidad y wiki. Opcional — si no hay LASTFM_API_KEY se omite.

const BASE = "https://ws.audioscrobbler.com/2.0/";

export type LastfmAlbumInfo = {
  tags: string[];
  listeners?: number;
  wikiSummary?: string;
};

export async function getAlbumInfo(
  album: string,
  artist: string,
): Promise<LastfmAlbumInfo | null> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return null;

  const params = new URLSearchParams({
    method: "album.getinfo",
    api_key: key,
    artist,
    album,
    format: "json",
    lang: "es",
  });
  const res = await fetch(`${BASE}?${params}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    album?: {
      listeners?: string;
      tags?: { tag?: { name: string }[] };
      wiki?: { summary?: string };
    };
  };
  if (!data.album) return null;
  return {
    tags: (data.album.tags?.tag ?? []).map((t) => t.name),
    listeners: data.album.listeners ? Number(data.album.listeners) : undefined,
    // El summary de Last.fm trae un link HTML al final — se limpia.
    wikiSummary: data.album.wiki?.summary?.replace(/<a href[\s\S]*$/, "").trim() || undefined,
  };
}
