// Fase 6.2 — cliente Spotify Web API (top artists/tracks para el motor).

const SPOTIFY_API = "https://api.spotify.com/v1";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

type SpotifyArtist = {
  name: string;
  genres?: string[];
};

type SpotifyTopArtistsResponse = {
  items?: SpotifyArtist[];
};

type SpotifyTrack = {
  name: string;
  artists?: { name: string }[];
};

type SpotifyTopTracksResponse = {
  items?: SpotifyTrack[];
};

export type SpotifyTasteSnapshot = {
  artists: string[];
  genres: string[];
  tracks: string[];
};

export function spotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

/** Solo true si el dueño activó Spotify a propósito (no visible por defecto). */
export function spotifyPublicEnabled(): boolean {
  return process.env.SPOTIFY_PUBLIC === "true" && spotifyConfigured();
}

export async function refreshSpotifyAccessToken(account: {
  id: string;
  refresh_token: string | null;
}): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret || !account.refresh_token) return null;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
  };
  if (!data.access_token) return null;

  const { prisma } = await import("./db");
  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: data.access_token,
      expires_at: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
    },
  });
  return data.access_token;
}

export async function getSpotifyAccessToken(userId: string): Promise<string | null> {
  const { prisma } = await import("./db");
  const account = await prisma.account.findFirst({
    where: { userId, provider: "spotify" },
  });
  if (!account?.access_token) return null;

  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at > now + 90) {
    return account.access_token;
  }
  return refreshSpotifyAccessToken(account);
}

async function spotifyGet<T>(token: string, path: string): Promise<T | null> {
  const res = await fetch(`${SPOTIFY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

export async function fetchSpotifyTaste(token: string): Promise<SpotifyTasteSnapshot> {
  const [artistsRes, tracksRes] = await Promise.all([
    spotifyGet<SpotifyTopArtistsResponse>(
      token,
      "/me/top/artists?limit=25&time_range=medium_term",
    ),
    spotifyGet<SpotifyTopTracksResponse>(
      token,
      "/me/top/tracks?limit=15&time_range=medium_term",
    ),
  ]);

  const artists = (artistsRes?.items ?? [])
    .map((a) => a.name?.trim())
    .filter(Boolean) as string[];

  const genreCounts = new Map<string, number>();
  for (const a of artistsRes?.items ?? []) {
    for (const g of a.genres ?? []) {
      const key = g.trim();
      if (!key) continue;
      genreCounts.set(key, (genreCounts.get(key) ?? 0) + 1);
    }
  }
  const genres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([g]) => g);

  const tracks = (tracksRes?.items ?? [])
    .map((t) => {
      const artist = t.artists?.[0]?.name?.trim();
      const name = t.name?.trim();
      if (!name || !artist) return null;
      return `"${name}" de ${artist}`;
    })
    .filter(Boolean) as string[];

  return { artists, genres, tracks };
}
