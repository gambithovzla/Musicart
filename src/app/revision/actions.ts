"use server";

// Acciones del panel de revisión (Fase 2.3). Solo admins (ADMIN_EMAILS).

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import {
  bootstrapCatalogQueue,
  enqueueAlbum,
  proposeNextAlbums,
  queueKey,
} from "@/lib/curator";
import { runDossierPipeline } from "@/lib/dossier/pipeline";
import { recomputeImpact } from "@/lib/dossier/impact";
import { parseJson, type FactsPayload } from "@/lib/types";
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
async function cargarPerfilAdmin(): Promise<{ genres: string[]; artists: string[]; languages: string[] } | null> {
  try {
    const session = await auth();
    if (!session?.user?.id && !session?.user?.email) return null;
    const where = session.user.id
      ? { userId: session.user.id }
      : { deviceId: session.user.email! };
    const profile = await prisma.profile.findFirst({ where });
    if (!profile) return null;
    const data = parseJson<Record<string, unknown>>(profile.answersJson, {});
    const genres = Array.isArray(data.genres)
      ? (data.genres as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    const artists = Array.isArray(data.artists)
      ? (data.artists as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    const languages = Array.isArray(data.languages)
      ? (data.languages as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    return genres.length || artists.length || languages.length
      ? { genres, artists, languages }
      : null;
  } catch {
    return null;
  }
}

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

  // 1. Cargar perfil del admin para que el curador proponga según su gusto.
  const perfilAdmin = await cargarPerfilAdmin();

  // 2. Si el admin tiene perfil, siempre proponemos primero: así los álbumes que
  //    encajan con su gusto llegan con prioridad ≤ 20 y ganan a ítems viejos de
  //    la cola que no tienen relación con él (p. ej. sugerencias genéricas anteriores).
  if (perfilAdmin) {
    try {
      await proposeNextAlbums(3, () => {}, perfilAdmin);
    } catch {
      // sin API key: los clásicos siguen disponibles como respaldo
    }
  }

  let item = await prisma.generationQueue.findFirst({
    where: pendienteWhere,
    orderBy: ordenPrioridad,
  });
  if (!item) {
    if (!perfilAdmin) {
      // sin perfil: propuesta genérica o clásicos de respaldo
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

/**
 * Pone o quita un disco de la vitrina del curador (Album.showcase). Solo admin.
 * Al ponerlo, guarda la fecha para ordenar la exhibición por lo más reciente.
 */
export async function toggleVitrina(
  albumId: string,
): Promise<{ ok: boolean; showcase: boolean; message: string }> {
  await requireAdmin();
  if (!albumId) return { ok: false, showcase: false, message: "Falta el id del disco." };
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { showcase: true, title: true },
  });
  if (!album) return { ok: false, showcase: false, message: "Ese disco ya no existe." };

  const nuevo = !album.showcase;
  await prisma.album.update({
    where: { id: albumId },
    data: { showcase: nuevo, showcaseAt: nuevo ? new Date() : null },
  });
  revalidatePath("/vitrina");
  revalidatePath("/revision");
  revalidatePath(`/album/${albumId}`);
  return {
    ok: true,
    showcase: nuevo,
    message: nuevo
      ? `«${album.title}» entró a la vitrina.`
      : `«${album.title}» salió de la vitrina.`,
  };
}

/**
 * Asigna (o quita) el estante temático de un disco en la vitrina. Solo admin.
 * Un texto vacío lo deja sin estante. Poner estante también lo mete a la vitrina
 * (si no lo estaba), porque agrupar algo implica exhibirlo.
 */
export async function setEstante(
  albumId: string,
  shelf: string,
): Promise<{ ok: boolean; shelf: string | null; message: string }> {
  await requireAdmin();
  if (!albumId) return { ok: false, shelf: null, message: "Falta el id del disco." };
  const limpio = shelf.trim().slice(0, 60) || null;

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { showcase: true },
  });
  if (!album) return { ok: false, shelf: null, message: "Ese disco ya no existe." };

  await prisma.album.update({
    where: { id: albumId },
    data: {
      showcaseShelf: limpio,
      // Si le pones estante y no estaba en la vitrina, entra.
      ...(limpio && !album.showcase ? { showcase: true, showcaseAt: new Date() } : {}),
    },
  });
  revalidatePath("/vitrina");
  revalidatePath("/revision");
  return {
    ok: true,
    shelf: limpio,
    message: limpio ? `Estante: «${limpio}».` : "Sin estante.",
  };
}

/**
 * Puntúa un disco como curador (1-10) desde el panel. Reutiliza el modelo
 * Review con el userId del admin, conservando el comentario/canción favorita si
 * ya existía una reseña. Es el mismo puntaje que se muestra en el dossier y la
 * vitrina.
 */
export async function puntuarAlbumAdmin(
  albumId: string,
  rating: number,
): Promise<{ ok: boolean; rating: number; message: string }> {
  const session = await requireAdmin();
  const userId = session.user?.id;
  if (!userId) return { ok: false, rating: 0, message: "Sesión sin id de usuario." };
  if (!albumId) return { ok: false, rating: 0, message: "Falta el id del disco." };

  const r = Math.min(10, Math.max(1, Math.round(rating)));
  const existing = await prisma.review.findFirst({ where: { userId, albumId } });
  if (existing) {
    await prisma.review.update({ where: { id: existing.id }, data: { rating: r } });
  } else {
    await prisma.review.create({
      data: { deviceId: `admin-${userId}`, userId, albumId, rating: r, answersJson: "{}" },
    });
  }
  revalidatePath("/vitrina");
  revalidatePath("/revision");
  revalidatePath(`/album/${albumId}`);
  return { ok: true, rating: r, message: `Puntuaste «${r}/10».` };
}

export async function generateDossierTts(
  dossierId: string,
): Promise<{ message: string; ok: boolean }> {
  await requireAdmin();
  try {
    const loaded = await loadDossierForTts(dossierId);
    if (!loaded) return { ok: false, message: "Dossier no encontrado." };

    await renderDossierAudio(loaded.dossierId, loaded.input);
    revalidatePath("/revision");
    revalidatePath(`/album/${loaded.albumId}`);
    return {
      ok: true,
      message: `Audio listo: «${loaded.albumTitle}» — ${loaded.artistName}`,
    };
  } catch (e) {
    // En prod, Next oculta los errores lanzados; los devolvemos como dato para
    // que el admin vea la causa real (p. ej. "falta BLOB_READ_WRITE_TOKEN").
    return { ok: false, message: `No se pudo generar el audio. ${(e as Error).message}` };
  }
}

export async function generateMissingTts(
  limit = 5,
): Promise<{ message: string; ok: boolean }> {
  await requireAdmin();
  try {
    const pending = await findDossiersMissingAudio(limit);
    if (pending.length === 0) {
      return { ok: true, message: "Todos los dossiers publicados ya tienen audio." };
    }

    for (const d of pending) {
      await renderDossierAudio(d.id, dossierAudioInputFromRow(d));
      revalidatePath(`/album/${d.albumId}`);
    }
    revalidatePath("/revision");

    const names = pending.map((d) => `«${d.album.title}»`).join(", ");
    return {
      ok: true,
      message: `Audio generado para ${pending.length} disco(s): ${names}`,
    };
  } catch (e) {
    return { ok: false, message: `No se pudo generar el audio. ${(e as Error).message}` };
  }
}

/**
 * Recalcula en lote el impacto de los discos viejos que quedaron pegados en 72
 * (la IA copiaba el ejemplo). Procesa hasta `limit` por corrida; el admin puede
 * tocar el botón otra vez para seguir. Aprovecha maxDuration=300.
 */
export async function recalcularImpactos(
  limit = 20,
): Promise<{ message: string; ok: boolean }> {
  await requireAdmin();
  try {
    const pegados = await prisma.album.findMany({
      where: { impact: 72, dossiers: { some: { locale: "es" } } },
      include: { dossiers: { where: { locale: "es" }, select: { id: true } } },
      take: limit,
    });
    if (pegados.length === 0) {
      return { ok: true, message: "No quedan discos en 72 — todos tienen impacto real. ✓" };
    }

    let hechos = 0;
    for (const album of pegados) {
      const payload = parseJson<FactsPayload | null>(album.factsJson, null);
      if (!payload) continue;
      try {
        const { impact, impactNote } = await recomputeImpact(payload);
        await prisma.album.update({ where: { id: album.id }, data: { impact } });
        if (impactNote) {
          await prisma.dossier.updateMany({
            where: { albumId: album.id, locale: "es" },
            data: { impactNote },
          });
        }
        hechos++;
        revalidatePath(`/album/${album.id}`);
      } catch {
        // un disco que falle no detiene el lote
      }
    }

    const restantes = await prisma.album.count({ where: { impact: 72 } });
    revalidatePath("/revision");
    revalidatePath("/explorar");
    return {
      ok: true,
      message: `Recalculados ${hechos} disco(s).${restantes > 0 ? ` Quedan ${restantes} en 72 — toca de nuevo para seguir.` : " ¡Listo, no quedan en 72!"}`,
    };
  } catch (e) {
    return { ok: false, message: `No se pudo recalcular. ${(e as Error).message}` };
  }
}

/**
 * Borra un disco del catálogo por completo (dossier, notas, reseñas, picks…).
 * Solo admin. Útil para limpiar un sencillo que se coló o un disco no deseado.
 */
export async function borrarAlbum(
  albumId: string,
): Promise<{ message: string; ok: boolean }> {
  await requireAdmin();
  if (!albumId) return { ok: false, message: "Falta el id del disco." };
  try {
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { title: true },
    });
    if (!album) return { ok: false, message: "Ese disco ya no existe." };

    // Borramos los hijos sin cascade automática, luego el álbum (DossierView sí
    // cascadea). Todo en una transacción para no dejar restos.
    await prisma.$transaction([
      prisma.trackNote.deleteMany({ where: { dossier: { albumId } } }),
      prisma.dossier.deleteMany({ where: { albumId } }),
      prisma.review.deleteMany({ where: { albumId } }),
      prisma.dailyPick.deleteMany({ where: { albumId } }),
      prisma.duetPick.deleteMany({ where: { albumId } }),
      prisma.dossierChat.deleteMany({ where: { albumId } }),
      prisma.album.delete({ where: { id: albumId } }),
    ]);

    revalidatePath("/explorar");
    revalidatePath("/revision");
    return { ok: true, message: `Borrado: «${album.title}».` };
  } catch (e) {
    return { ok: false, message: `No se pudo borrar. ${(e as Error).message}` };
  }
}
