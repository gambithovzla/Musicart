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
import {
  llm,
  llmGeneration,
  hayClaveIA,
  generationModel,
  runtimeModelName,
  usaDialectoDeRazonamiento,
} from "@/lib/dossier/llm";
import { recomputeImpact } from "@/lib/dossier/impact";
import {
  detectarPaisesPedido,
  diagnosticoDeOrigen,
  type SondaOrigen,
  type VeredictoOrigen,
} from "@/lib/origin-guard";
import { parseJson, type FactsPayload } from "@/lib/types";
import {
  dossierAudioInputFromRow,
  findDossiersMissingAudio,
  loadDossierForTts,
  renderDossierAudio,
} from "@/lib/dossier/render-audio";
import { generateSocialContent } from "@/lib/social/generate";
import type { SocialVerification } from "@/lib/social/types";

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

export async function createSocialDraft(dossierId: string): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  try {
    const content = await generateSocialContent(dossierId);
    revalidatePath("/revision");
    return content.status === "draft"
      ? { ok: true, message: "El editor creó el guion y superó la verificación factual." }
      : { ok: false, message: "El guion quedó bloqueado porque no superó la verificación. Revisa sus recibos." };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

export async function approveSocialDraft(contentId: string): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const content = await prisma.socialContent.findUnique({ where: { id: contentId } });
  if (!content) return { ok: false, message: "La pieza ya no existe." };
  const verification = parseJson<SocialVerification | null>(content.verificationJson, null);
  if (!verification?.ok) return { ok: false, message: "No se puede aprobar: la verificación factual no está limpia." };
  if (content.rightsStatus !== "clear") return { ok: false, message: "No se puede aprobar: falta resolver los derechos de los recursos." };
  if (!["draft", "failed"].includes(content.status)) {
    return { ok: false, message: `La pieza ya está en estado ${content.status}.` };
  }
  await prisma.socialContent.update({
    where: { id: contentId },
    data: { status: "approved", error: null },
  });
  revalidatePath("/revision");
  return { ok: true, message: "Pieza aprobada. El worker ya puede generar la voz y el MP4." };
}

export async function archiveSocialDraft(contentId: string): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  await prisma.socialContent.update({ where: { id: contentId }, data: { status: "archived" } });
  revalidatePath("/revision");
  return { ok: true, message: "Pieza retirada de la mesa editorial." };
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

/**
 * ¿EL CURADOR ESTÁ VIVO? (diagnóstico del dueño, sin terminal.)
 *
 * Existe porque la app está diseñada para no caerse nunca: si la IA no responde
 * —clave vencida, sin saldo, un modelo mal escrito en las variables, un 429—
 * el disco del día cae al catálogo y se sirve igual, en tres segundos y sin una
 * palabra. Desde fuera eso no se ve como "la IA está caída": se vive como "la
 * app dejó de leer lo que le pido y me repite discos". Este botón hace UNA
 * llamada de verdad a cada modelo y dice qué contestaron.
 *
 * Cuesta céntimos (dos llamadas de 5 tokens) y solo corre cuando lo pulsas.
 */
export async function probarCurador(): Promise<{
  hayClave: boolean;
  proveedor: string;
  pruebas: {
    nombre: string;
    modelo: string;
    ok: boolean;
    ms: number;
    detalle: string;
  }[];
}> {
  await requireAdmin();

  const hayClave = hayClaveIA();
  const proveedor =
    process.env.LLM_PROVIDER?.toLowerCase() ||
    (process.env.OPENAI_API_KEY ? "openai" : process.env.ANTHROPIC_API_KEY ? "anthropic" : "—");

  if (!hayClave) {
    return {
      hayClave,
      proveedor,
      pruebas: [
        {
          nombre: "Clave de IA",
          modelo: "—",
          ok: false,
          ms: 0,
          detalle:
            "No hay OPENAI_API_KEY ni ANTHROPIC_API_KEY. Sin clave no se fabrica " +
            "ningún disco nuevo: todo sale del catálogo ya publicado.",
        },
      ],
    };
  }

  // Dos modelos, dos trabajos: el barato atiende el runtime (elegir del
  // catálogo, verificar el pedido) y el de generación propone y escribe. Pueden
  // fallar por separado — un GENERATION_MODEL mal escrito rompe justo la parte
  // que fabrica el disco a tu medida, y el resto sigue funcionando.
  const pruebas: {
    nombre: string;
    modelo: string;
    ok: boolean;
    ms: number;
    detalle: string;
  }[] = [];

  const sondas: { nombre: string; modelo: string; llamar: () => Promise<string> }[] = [
    {
      nombre: "Runtime (elige y verifica)",
      modelo: runtimeModelName(),
      llamar: () =>
        llm({ system: "Responde solo: ok", user: "ok", maxTokens: 5, timeoutMs: 15_000 }),
    },
    {
      nombre: "Generación (propone y escribe)",
      modelo: generationModel(),
      llamar: () =>
        llmGeneration({
          system: "Responde solo: ok",
          user: "ok",
          maxTokens: 5,
          timeoutMs: 20_000,
        }),
    },
  ];

  for (const sonda of sondas) {
    const t0 = Date.now();
    // Con qué dialecto se le está hablando: los modelos de razonamiento (o1, o3,
    // gpt-5) usan otros parámetros, y poner uno de esos sin saberlo era romper
    // TODAS las llamadas con la cuenta llena de saldo.
    const dialecto = usaDialectoDeRazonamiento(sonda.modelo)
      ? " · modelo de razonamiento"
      : "";
    try {
      const raw = await sonda.llamar();
      pruebas.push({
        nombre: sonda.nombre,
        modelo: `${sonda.modelo}${dialecto}`,
        ok: true,
        ms: Date.now() - t0,
        detalle: `Contestó: "${raw.trim().slice(0, 40)}"`,
      });
    } catch (e) {
      pruebas.push({
        nombre: sonda.nombre,
        modelo: `${sonda.modelo}${dialecto}`,
        ok: false,
        ms: Date.now() - t0,
        detalle: (e as Error).message.slice(0, 240),
      });
    }
  }

  return { hayClave, proveedor, pruebas };
}

/**
 * «¿Sabe la app de dónde es este artista?» — el diagnóstico de las tres fuentes
 * del origen (7.9, ampliada en ago 2026).
 *
 * Por qué hace falta: MusicBrainz, Wikidata y la Wikipedia son APIs públicas de
 * terceros. Si una se cae o cambia, la barrera NO se rompe — se calla y deja
 * pasar, que es lo correcto pero también lo invisible: desde fuera solo se ve
 * que vuelven los avisos de "no pude confirmar que sea de Venezuela", o peor,
 * que se cuela un artista de otro país. Esto pregunta a las tres delante de ti
 * y enseña qué contestó cada una. No gasta IA: son datos abiertos.
 */
export async function probarOrigen(
  artista: string,
  pedido: string,
): Promise<{
  paises: string[];
  sondas: SondaOrigen[];
  veredicto: VeredictoOrigen["veredicto"];
  origen: string | null;
  fuente: string | null;
}> {
  await requireAdmin();

  const paises = detectarPaisesPedido(pedido);
  if (paises.length === 0) {
    return { paises: [], sondas: [], veredicto: "desconocido", origen: null, fuente: null };
  }

  const { sondas, veredicto } = await diagnosticoDeOrigen(artista.trim(), paises);
  return {
    paises: paises.map((p) => p.nombre),
    sondas,
    veredicto: veredicto.veredicto,
    origen: veredicto.origen,
    fuente: veredicto.fuente ?? null,
  };
}
