import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

async function saveLocal(id: string, filename: string, data: Buffer): Promise<string> {
  const dir = path.join(process.cwd(), "public", "social", id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), data);
  return `/social/${id}/${filename}`;
}

async function saveBlob(id: string, filename: string, data: Buffer, contentType: string) {
  const blob = await put(`social/${id}/${filename}`, data, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}

async function save(id: string, filename: string, data: Buffer, contentType: string) {
  if (process.env.BLOB_READ_WRITE_TOKEN) return saveBlob(id, filename, data, contentType);
  if (process.env.VERCEL) {
    throw new Error("El trabajador social necesita BLOB_READ_WRITE_TOKEN para guardar medios en producción.");
  }
  return saveLocal(id, filename, data);
}

export function saveSocialAudio(id: string, mp3: Buffer) {
  return save(id, "voice.mp3", mp3, "audio/mpeg");
}

export async function saveSocialVideo(id: string, filePath: string) {
  return save(id, "video.mp4", await readFile(filePath), "video/mp4");
}

