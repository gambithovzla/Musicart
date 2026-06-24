"use server";

// Cuéntale al curador: dos caminos desde el dossier.
//   guardarComentario     → GRATIS: solo guarda en la memoria del oyente.
//   pedirRespuestaMelomano → CON COSTO: guarda + responde el melómano (límite del chat).

import { auth } from "@/auth";
import { getListenerIdentity } from "@/lib/identity";
import { guardarNota, responderMelomano } from "@/lib/listener-notes";

type AlbumCtx = {
  albumId: string;
  albumTitle: string;
  albumArtist: string;
  text: string;
  deviceId: string;
};

async function identidad(deviceId: string) {
  const [session, identity] = await Promise.all([auth(), getListenerIdentity()]);
  return {
    merged: {
      userId: session?.user?.id ?? identity.userId,
      deviceId: deviceId || identity.deviceId,
    },
    email: session?.user?.email,
  };
}

/** Camino GRATIS: guarda el comentario en la memoria, sin llamar a la IA. */
export async function guardarComentario(input: AlbumCtx) {
  const { merged } = await identidad(input.deviceId);
  return guardarNota(merged, {
    albumId: input.albumId,
    albumTitle: input.albumTitle,
    albumArtist: input.albumArtist,
    text: input.text,
    source: "free",
  });
}

/** Camino CON COSTO: guarda y devuelve la respuesta del melómano. */
export async function pedirRespuestaMelomano(input: AlbumCtx) {
  const { merged, email } = await identidad(input.deviceId);
  return responderMelomano(
    merged,
    {
      albumId: input.albumId,
      albumTitle: input.albumTitle,
      albumArtist: input.albumArtist,
      text: input.text,
    },
    email,
  );
}
