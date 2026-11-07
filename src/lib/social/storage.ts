import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";

async function saveLocal(id: string, filename: string, data: Buffer): Promise<string> {
  const dir = path.join(process.cwd(), "public", "social", id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), data);
  return `/social/${id}/${filename}`;
}

// El almacén de Blob del dueño es PRIVADO ("Cannot use public access on a
// private store"). Se intenta público (lo que esperaba el código original) y,
// si el almacén no lo admite, privado. Un archivo privado no se abre con su URL
// a pelo: la voz se sirve a la laptop por /api/social/del-dia/voz, con la llave.
async function saveBlob(id: string, filename: string, data: Buffer, contentType: string) {
  const opciones = { contentType, addRandomSuffix: false, allowOverwrite: true };
  try {
    const blob = await put(`social/${id}/${filename}`, data, { ...opciones, access: "public" });
    return blob.url;
  } catch (err) {
    if (!/private/i.test((err as Error).message)) throw err;
    const blob = await put(`social/${id}/${filename}`, data, { ...opciones, access: "private" });
    return blob.url;
  }
}

/** Lee un archivo guardado (público o privado) para reenviarlo a quien tenga la llave. */
export async function leerMedio(url: string): Promise<{ stream: ReadableStream; contentType: string } | null> {
  for (const access of ["private", "public"] as const) {
    try {
      const r = await get(url, { access });
      if (r?.stream) return { stream: r.stream, contentType: r.blob.contentType ?? "application/octet-stream" };
    } catch {
      // probar con el otro tipo de acceso
    }
  }
  return null;
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

