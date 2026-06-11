"use server";

// Acciones del panel de revisión (Fase 2.3). Solo admins (ADMIN_EMAILS).

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import {
  dossierAudioInputFromRow,
  findDossiersMissingAudio,
  loadDossierForTts,
  renderDossierAudio,
} from "@/lib/dossier/render-audio";

export async function publishDossier(dossierId: string) {
  await requireAdmin();
  await prisma.dossier.update({
    where: { id: dossierId },
    data: { status: "published" },
  });
  revalidatePath("/revision");
}

export async function discardDossier(dossierId: string) {
  await requireAdmin();
  await prisma.trackNote.deleteMany({ where: { dossierId } });
  await prisma.dossier.delete({ where: { id: dossierId } });
  revalidatePath("/revision");
}

export async function generateDossierTts(
  dossierId: string,
): Promise<{ message: string }> {
  await requireAdmin();
  const loaded = await loadDossierForTts(dossierId);
  if (!loaded) throw new Error("Dossier no encontrado");

  await renderDossierAudio(loaded.dossierId, loaded.input);
  revalidatePath("/revision");
  revalidatePath(`/album/${loaded.albumId}`);
  return {
    message: `Audio listo: «${loaded.albumTitle}» — ${loaded.artistName}`,
  };
}

export async function generateMissingTts(limit = 5): Promise<{ message: string }> {
  await requireAdmin();
  const pending = await findDossiersMissingAudio(limit);
  if (pending.length === 0) {
    return { message: "Todos los dossiers publicados ya tienen audio." };
  }

  for (const d of pending) {
    await renderDossierAudio(d.id, dossierAudioInputFromRow(d));
    revalidatePath(`/album/${d.albumId}`);
  }
  revalidatePath("/revision");

  const names = pending.map((d) => `«${d.album.title}»`).join(", ");
  return {
    message: `Audio generado para ${pending.length} disco(s): ${names}`,
  };
}
