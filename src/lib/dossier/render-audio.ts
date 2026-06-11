// Pre-renderiza MP3s del dossier y actualiza audioJson en la base de datos.

import { prisma } from "../db";
import { synthesizeSpeech } from "../tts";
import { parseJson, type DossierAudio } from "../types";
import { resolveAudioStorage } from "./audio-storage";

export type DossierAudioInput = {
  intro: string;
  artistStory: string;
  whyItMatters: string;
  tracks?: string;
};

export function dossierHasAudio(audioJson: string | null | undefined): boolean {
  const audio = parseJson<DossierAudio | null>(audioJson, null);
  return Boolean(audio?.intro && audio?.artistStory && audio?.whyItMatters);
}

export async function findDossiersMissingAudio(limit = 5) {
  const all = await prisma.dossier.findMany({
    where: { locale: "es", status: "published" },
    include: {
      album: { include: { artist: true } },
      trackNotes: { orderBy: { position: "asc" } },
    },
    orderBy: { id: "asc" },
  });
  return all.filter((d) => !dossierHasAudio(d.audioJson)).slice(0, limit);
}

export async function renderDossierAudio(
  dossierId: string,
  content: DossierAudioInput,
  log: (msg: string) => void = () => {},
): Promise<DossierAudio> {
  const storage = resolveAudioStorage();
  const audio: DossierAudio = {};
  const entries: { key: keyof DossierAudio; text: string }[] = [
    { key: "intro", text: content.intro },
    { key: "artistStory", text: content.artistStory },
    ...(content.tracks ? [{ key: "tracks" as const, text: content.tracks }] : []),
    { key: "whyItMatters", text: content.whyItMatters },
  ];

  for (const { key, text } of entries) {
    if (!text.trim()) continue;
    log(`  Sintetizando ${key} (${text.length} caracteres)…`);
    const mp3 = await synthesizeSpeech(text);
    audio[key] = await storage.save(dossierId, key, mp3);
    log(`  ✓ ${audio[key]}`);
  }

  await prisma.dossier.update({
    where: { id: dossierId },
    data: { audioJson: JSON.stringify(audio) },
  });

  return audio;
}

export async function loadDossierForTts(
  dossierId: string,
): Promise<{
  dossierId: string;
  albumId: string;
  albumTitle: string;
  artistName: string;
  input: DossierAudioInput;
} | null> {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      album: { include: { artist: true } },
      trackNotes: { where: { note: { not: null } }, orderBy: { position: "asc" } },
    },
  });
  if (!dossier) return null;

  const tracks =
    dossier.trackNotes.length > 0
      ? dossier.trackNotes
          .map((t) => `Canción ${t.position}: ${t.title}. ${t.note}`)
          .join(" ")
      : undefined;

  return {
    dossierId: dossier.id,
    albumId: dossier.albumId,
    albumTitle: dossier.album.title,
    artistName: dossier.album.artist.name,
    input: {
      intro: dossier.intro,
      artistStory: dossier.artistStory,
      whyItMatters: dossier.whyItMatters,
      tracks,
    },
  };
}

export function dossierAudioInputFromRow(dossier: {
  id: string;
  intro: string;
  artistStory: string;
  whyItMatters: string;
  trackNotes: { position: number; title: string; note: string | null }[];
}): DossierAudioInput {
  const noted = dossier.trackNotes.filter((t) => t.note);
  return {
    intro: dossier.intro,
    artistStory: dossier.artistStory,
    whyItMatters: dossier.whyItMatters,
    tracks:
      noted.length > 0
        ? noted.map((t) => `Canción ${t.position}: ${t.title}. ${t.note}`).join(" ")
        : undefined,
  };
}
