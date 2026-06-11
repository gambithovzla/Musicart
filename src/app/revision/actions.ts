"use server";

// Acciones del panel de revisión (Fase 2.3). Solo admins (ADMIN_EMAILS).

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import {
  bootstrapCatalogQueue,
  enqueueAlbum,
  proposeNextAlbums,
  queueKey,
} from "@/lib/curator";
import { runDossierPipeline } from "@/lib/dossier/pipeline";
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

export type GenerarAlbumResult = {
  message: string;
  albumId: string | null;
  // "published" | "draft" si terminó en vivo; "queued" si quedó para el robot.
  estado: "published" | "draft" | "queued";
};

/**
 * Crea un disco a demanda desde el panel (el dueño elige qué y cuándo).
 * Genera en vivo (tarda 1-3 min) y, como red de seguridad, lo deja también en
 * la cola con prioridad máxima: si la generación en vivo no alcanza a terminar
 * (timeout de Vercel), el worker lo recoge en su próxima corrida.
 */
export async function generarAlbumAhora(input: {
  title: string;
  artist: string;
  publish: boolean;
}): Promise<GenerarAlbumResult> {
  await requireAdmin();
  const title = input.title.trim();
  const artist = input.artist.trim();
  if (!title || !artist) {
    throw new Error("Escribe el disco y el artista.");
  }

  // Red de seguridad: a la cola con prioridad máxima (no estorba si ya existe).
  await enqueueAlbum({
    title,
    artist,
    source: "manual",
    priority: 1,
    reason: "Pedido a mano desde el panel",
  });

  try {
    const result = await runDossierPipeline(title, artist, {
      publish: input.publish,
    });

    // Terminó en vivo: la cola ya no necesita reintentarlo.
    const observaciones = result.report.ok
      ? null
      : [...result.report.hardErrors, ...result.report.unsupportedClaims]
          .slice(0, 5)
          .join(" · ")
          .slice(0, 500);
    await prisma.generationQueue.updateMany({
      where: { key: queueKey(title, artist) },
      data: { status: "done", result: result.status, error: observaciones },
    });

    revalidatePath("/revision");
    revalidatePath(`/album/${result.albumId}`);

    const message =
      result.status === "published"
        ? `✓ «${title}» de ${artist} ya está publicado en el catálogo.`
        : `◦ «${title}» quedó como borrador: la verificación encontró algo que revisar. Léelo abajo y decide si lo publicas.`;
    return { message, albumId: result.albumId, estado: result.status };
  } catch (e) {
    // No terminó en vivo, pero sigue en la cola con prioridad máxima.
    const detalle = (e as Error).message.slice(0, 200);
    revalidatePath("/revision");
    return {
      message: `No pude crearlo en vivo (${detalle}). Quedó en la cola con prioridad máxima: el robot lo intentará en su próxima corrida.`,
      albumId: null,
      estado: "queued",
    };
  }
}

/**
 * Un botón y nada más: la IA decide qué disco le falta al catálogo (huecos,
 * lo que la gente puntúa alto, diversidad — la misma lógica del curador que ya
 * corre cada día), lo genera y lo deja publicado. El dueño no escribe nada.
 *
 * Es "una corrida del worker, a mano": si no hay nada propuesto, el curador
 * propone; luego genera el de mayor prioridad. Aprovecha maxDuration=300.
 */
export async function generarDiscoSugerido(): Promise<GenerarAlbumResult> {
  await requireAdmin();

  const pendienteWhere = {
    OR: [
      { status: "pending" as const },
      { status: "failed" as const, attempts: { lt: 3 } },
    ],
  };
  const ordenPrioridad = [
    { priority: "asc" as const },
    { createdAt: "asc" as const },
  ];

  // 1. ¿Ya hay algo propuesto? Si no, que el curador IA proponga (o clásicos).
  let item = await prisma.generationQueue.findFirst({
    where: pendienteWhere,
    orderBy: ordenPrioridad,
  });
  if (!item) {
    try {
      await proposeNextAlbums(3);
    } catch {
      await bootstrapCatalogQueue(3);
    }
    item = await prisma.generationQueue.findFirst({
      where: pendienteWhere,
      orderBy: ordenPrioridad,
    });
  }
  if (!item) {
    revalidatePath("/revision");
    return {
      message:
        "La IA no encontró un disco nuevo que proponer ahora mismo (puede que ya tengas en cola todo lo que se le ocurrió). Inténtalo de nuevo en un momento.",
      albumId: null,
      estado: "queued",
    };
  }

  // 2. Generar ese disco (publica si pasa la verificación).
  await prisma.generationQueue.update({
    where: { id: item.id },
    data: { status: "running", attempts: { increment: 1 } },
  });
  try {
    const result = await runDossierPipeline(item.title, item.artist, {
      publish: true,
    });
    const observaciones = result.report.ok
      ? null
      : [...result.report.hardErrors, ...result.report.unsupportedClaims]
          .slice(0, 5)
          .join(" · ")
          .slice(0, 500);
    await prisma.generationQueue.update({
      where: { id: item.id },
      data: { status: "done", result: result.status, error: observaciones },
    });
    revalidatePath("/revision");
    revalidatePath(`/album/${result.albumId}`);

    const message =
      result.status === "published"
        ? `✓ La IA eligió y publicó «${item.title}» de ${item.artist}.`
        : `◦ La IA generó «${item.title}» de ${item.artist}, pero quedó en borrador (revisa abajo y decide).`;
    return { message, albumId: result.albumId, estado: result.status };
  } catch (e) {
    const detalle = (e as Error).message.slice(0, 200);
    await prisma.generationQueue.update({
      where: { id: item.id },
      data: { status: "failed", error: detalle },
    });
    revalidatePath("/revision");
    return {
      message: `La IA propuso «${item.title}» de ${item.artist}, pero la generación falló (${detalle}). Queda en la cola para reintentar.`,
      albumId: null,
      estado: "queued",
    };
  }
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
