// Fase 6.2 — sincroniza gustos de Spotify al perfil del oyente.

import { prisma } from "./db";
import { profileWhere, type ListenerIdentity } from "./identity";
import { parseJson } from "./types";
import {
  fetchSpotifyTaste,
  getSpotifyAccessToken,
  spotifyConfigured,
} from "./spotify-api";

export type SpotifyProfileFields = {
  spotifyArtists?: string[];
  spotifyGenres?: string[];
  spotifyTracks?: string[];
  spotifySyncedAt?: string;
};

export async function userHasSpotifyAccount(userId: string): Promise<boolean> {
  const row = await prisma.account.findFirst({
    where: { userId, provider: "spotify" },
    select: { id: true },
  });
  return Boolean(row);
}

/** Lee top artists/tracks de Spotify y los guarda en answersJson del perfil. */
export async function syncSpotifyTasteForUser(
  userId: string,
  deviceId?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!spotifyConfigured()) {
    return { ok: false, error: "Spotify no configurado en el servidor." };
  }

  const token = await getSpotifyAccessToken(userId);
  if (!token) {
    return { ok: false, error: "No hay cuenta de Spotify vinculada o el token expiró." };
  }

  let taste;
  try {
    taste = await fetchSpotifyTaste(token);
  } catch (err) {
    console.error("[spotify-sync] fetch falló:", err);
    return { ok: false, error: "Spotify no respondió. Intenta más tarde." };
  }

  if (taste.artists.length === 0 && taste.genres.length === 0) {
    return { ok: false, error: "Spotify no devolvió gustos todavía (¿cuenta nueva?)." };
  }

  const identity: ListenerIdentity = { userId, deviceId: deviceId ?? "" };
  const filter = profileWhere(identity);

  const spotifyFields: SpotifyProfileFields = {
    spotifyArtists: taste.artists,
    spotifyGenres: taste.genres,
    spotifyTracks: taste.tracks,
    spotifySyncedAt: new Date().toISOString(),
  };

  if (filter) {
    const profile = await prisma.profile.findFirst({ where: filter });
    if (profile) {
      const answers = parseJson<Record<string, unknown>>(profile.answersJson, {});
      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          answersJson: JSON.stringify({ ...answers, ...spotifyFields }),
        },
      });
      return { ok: true };
    }
  }

  if (!deviceId) {
    return { ok: false, error: "Sin perfil ni dispositivo para guardar gustos." };
  }

  await prisma.profile.upsert({
    where: { deviceId },
    update: {
      userId,
      answersJson: JSON.stringify(spotifyFields),
    },
    create: {
      deviceId,
      userId,
      answersJson: JSON.stringify(spotifyFields),
    },
  });

  return { ok: true };
}

/** Quita la cuenta Spotify y borra las señales del perfil. */
export async function disconnectSpotify(userId: string): Promise<void> {
  await prisma.account.deleteMany({ where: { userId, provider: "spotify" } });

  const profile = await prisma.profile.findFirst({ where: { userId } });
  if (!profile) return;

  const answers = parseJson<Record<string, unknown>>(profile.answersJson, {});
  delete answers.spotifyArtists;
  delete answers.spotifyGenres;
  delete answers.spotifyTracks;
  delete answers.spotifySyncedAt;

  await prisma.profile.update({
    where: { id: profile.id },
    data: { answersJson: JSON.stringify(answers) },
  });
}
