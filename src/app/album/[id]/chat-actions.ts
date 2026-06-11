"use server";

// Fase 5.3 — preguntar al dossier (protegido por límites en album-chat.ts).

import { auth } from "@/auth";
import { askAlbumQuestion } from "@/lib/album-chat";
import { checkDossierAccess } from "@/lib/freemium";
import { getListenerIdentity } from "@/lib/identity";

export async function askDossierQuestion(
  albumId: string,
  question: string,
  deviceId: string,
) {
  const [session, identity] = await Promise.all([auth(), getListenerIdentity()]);
  const merged = {
    userId: session?.user?.id ?? identity.userId,
    deviceId: deviceId || identity.deviceId,
  };

  const access = await checkDossierAccess(
    merged,
    albumId,
    session?.user?.email,
  );
  if (!access.allowed) {
    return {
      ok: false as const,
      error: "Necesitas acceso al dossier para hacer preguntas.",
    };
  }

  return askAlbumQuestion(merged, albumId, question, session?.user?.email);
}
