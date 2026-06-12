"use server";

import { auth } from "@/auth";
import { cookies } from "next/headers";
import { DEVICE_COOKIE } from "@/lib/device";
import { parseJson } from "@/lib/types";
import { getListenerIdentity, findProfileRecord } from "@/lib/identity";
import { prisma } from "@/lib/db";
import {
  disconnectSpotify,
  syncSpotifyTasteForUser,
  userHasSpotifyAccount,
} from "@/lib/spotify-sync";
import { spotifyPublicEnabled } from "@/lib/spotify-api";

export type SpotifyPanelState = {
  configured: boolean;
  linked: boolean;
  syncedAt: string | null;
  artistPreview: string | null;
};

export async function getSpotifyPanelState(): Promise<SpotifyPanelState> {
  const session = await auth();
  const configured = spotifyPublicEnabled();

  if (!session?.user?.id || !configured) {
    return { configured, linked: false, syncedAt: null, artistPreview: null };
  }

  const linked = await userHasSpotifyAccount(session.user.id);
  const identity = await getListenerIdentity();
  const profile = await findProfileRecord(identity);
  let syncedAt: string | null = null;
  let artistPreview: string | null = null;

  if (profile) {
    const answers = parseJson<Record<string, unknown>>(profile.answersJson, {});
    syncedAt =
      typeof answers.spotifySyncedAt === "string" ? answers.spotifySyncedAt : null;
    const artists = Array.isArray(answers.spotifyArtists)
      ? answers.spotifyArtists.filter((x): x is string => typeof x === "string")
      : [];
    if (artists.length > 0) {
      const top = artists.slice(0, 3).join(", ");
      artistPreview =
        artists.length > 3 ? `${top} y ${artists.length - 3} más` : top;
    }
  }

  return { configured, linked, syncedAt, artistPreview };
}

export async function refreshSpotifyTaste(): Promise<{ ok: boolean; error?: string }> {
  if (!spotifyPublicEnabled()) {
    return { ok: false, error: "Spotify no está disponible todavía." };
  }
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Entra con tu cuenta para conectar Spotify." };
  }
  const deviceId = (await cookies()).get(DEVICE_COOKIE)?.value ?? "";
  return syncSpotifyTasteForUser(session.user.id, deviceId);
}

export async function unlinkSpotify(): Promise<{ ok: boolean }> {
  if (!spotifyPublicEnabled()) return { ok: false };
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await disconnectSpotify(session.user.id);
  return { ok: true };
}
