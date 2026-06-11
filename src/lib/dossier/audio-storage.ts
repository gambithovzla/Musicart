// Dónde guardar los MP3 del TTS: disco local (CLI/dev) o Vercel Blob (admin en prod).

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import type { DossierAudio } from "../types";

export type AudioStorage = {
  save(dossierId: string, key: keyof DossierAudio, mp3: Buffer): Promise<string>;
};

function filesystemStorage(): AudioStorage {
  return {
    async save(dossierId, key, mp3) {
      const dir = path.join(process.cwd(), "public", "audio", dossierId);
      await mkdir(dir, { recursive: true });
      const filename = `${key}.mp3`;
      await writeFile(path.join(dir, filename), mp3);
      return `/audio/${dossierId}/${filename}`;
    },
  };
}

function blobStorage(): AudioStorage {
  return {
    async save(dossierId, key, mp3) {
      const pathname = `audio/${dossierId}/${key}.mp3`;
      const blob = await put(pathname, mp3, {
        access: "public",
        contentType: "audio/mpeg",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return blob.url;
    },
  };
}

export function resolveAudioStorage(): AudioStorage {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return blobStorage();
  }
  if (process.env.VERCEL) {
    throw new Error(
      "En Vercel hace falta BLOB_READ_WRITE_TOKEN (Storage → Blob en el dashboard). " +
        "O genera audio en local con npm run tts.",
    );
  }
  return filesystemStorage();
}
