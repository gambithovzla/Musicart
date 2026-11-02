// Reescribir la historia de un disco que YA existe con el redactor nuevo.
//
// Las historias se escriben una vez y quedan cacheadas para siempre: mejorar el
// redactor no cambia las cientos que ya están publicadas con el molde viejo. Esto
// las rehace una a una (botón en el dossier para el admin, tanda desde /revision
// y `npm run reescribir` para el worker o la terminal).
//
// Tres garantías:
//   · NUNCA empeora: si la nueva no pasa la verificación, se queda la vieja.
//   · NUNCA cambia de disco: los hechos se vuelven a buscar (ahora con Wikipedia
//     en español E inglés), pero si lo encontrado no es el mismo disco se usan
//     los hechos guardados.
//   · No mueve los números: dificultad e impacto se quedan como estaban (los
//     oyentes ya los vieron y el Salón no depende de ellos).

import { prisma } from "../db";
import { gatherAlbumFacts } from "./facts";
import { escribirYVerificar } from "./pipeline";
import { plumaModelName } from "./llm";
import { parseJson, REDACCION_VERSION, type FactsPayload } from "../types";

export type ResultadoReescritura =
  | { ok: true; albumId: string; titulo: string; avisos: string[] }
  | { ok: false; albumId: string; titulo: string; motivo: string };

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

/** ¿Lo que trajeron las fuentes es el mismo disco que tenemos guardado? */
function mismoDisco(
  guardado: { mbid: string | null; title: string; artist: string },
  nuevo: { mbid: string | null; payload: FactsPayload },
): boolean {
  if (guardado.mbid && nuevo.mbid) return guardado.mbid === nuevo.mbid;
  const a = norm(guardado.title);
  const b = norm(nuevo.payload.album.title);
  const mismoTitulo = a === b || (a.length > 3 && (a.includes(b) || b.includes(a)));
  return mismoTitulo && norm(guardado.artist) === norm(nuevo.payload.album.artist);
}

export function yaReescrito(factsJson: string | null | undefined): boolean {
  const p = parseJson<Partial<FactsPayload>>(factsJson, {});
  return (p.redaccion?.version ?? 1) >= REDACCION_VERSION;
}

export async function reescribirHistoria(
  albumId: string,
  opciones: { log?: (msg: string) => void; forzar?: boolean } = {},
): Promise<ResultadoReescritura> {
  const log = opciones.log ?? (() => {});
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    include: { artist: true, dossiers: { where: { locale: "es" } } },
  });
  const dossierViejo = album?.dossiers[0];
  if (!album || !dossierViejo) {
    return { ok: false, albumId, titulo: album?.title ?? "?", motivo: "No tiene historia que reescribir." };
  }
  const titulo = `${album.title} — ${album.artist.name}`;
  if (!opciones.forzar && yaReescrito(album.factsJson)) {
    return { ok: false, albumId, titulo, motivo: "Ya está escrita con el redactor nuevo." };
  }

  const guardados = parseJson<FactsPayload | null>(album.factsJson, null);
  const avisos: string[] = [];

  // 1. Hechos frescos (más ricos: Wikipedia bilingüe), si son del mismo disco.
  let payload: FactsPayload | null = null;
  try {
    const nuevo = await gatherAlbumFacts(album.title, album.artist.name, log);
    if (mismoDisco({ mbid: album.mbid, title: album.title, artist: album.artist.name }, nuevo)) {
      payload = nuevo.payload;
    } else {
      avisos.push(
        `Las fuentes devolvieron otro disco («${nuevo.payload.album.title}»); uso los hechos guardados.`,
      );
    }
  } catch (err) {
    avisos.push(`No pude refrescar los hechos (${(err as Error).message.slice(0, 120)}); uso los guardados.`);
  }
  if (!payload) payload = guardados;
  if (!payload || !payload.album || !Array.isArray(payload.tracklist)) {
    return { ok: false, albumId, titulo, motivo: "No hay hechos con los que escribir." };
  }

  // El tracklist ya publicado manda: las notas de canción están atadas a él.
  if (guardados?.tracklist?.length && payload !== guardados) {
    payload.tracklist = guardados.tracklist;
  }

  // 2. Escribir y verificar.
  let resultado: Awaited<ReturnType<typeof escribirYVerificar>>;
  try {
    resultado = await escribirYVerificar(payload, log);
  } catch (err) {
    return { ok: false, albumId, titulo, motivo: `La IA no pudo escribirla: ${(err as Error).message.slice(0, 160)}` };
  }
  const { dossier, report } = resultado;
  if (!report.ok) {
    const n = report.hardErrors.length + report.unsupportedClaims.length;
    return {
      ok: false,
      albumId,
      titulo,
      motivo: `La nueva no pasó la verificación (${n} problema(s)); se queda la historia anterior.`,
    };
  }

  // 3. Guardar en una transacción: texto, notas de canción y hechos.
  payload.redaccion = {
    version: REDACCION_VERSION,
    fecha: new Date().toISOString(),
    modelo: plumaModelName(),
  };
  await prisma.$transaction([
    prisma.dossier.update({
      where: { id: dossierViejo.id },
      data: {
        intro: dossier.intro,
        artistStory: dossier.artistStory,
        whyItMatters: dossier.whyItMatters,
        questionsJson: JSON.stringify(dossier.questions),
        wowFactsJson: JSON.stringify(dossier.wowFacts ?? []),
        // Los saltos viejos se conservan si los nuevos vienen vacíos: ya
        // alimentaron la cola y puede que ya estén publicados.
        ...(dossier.jumps && dossier.jumps.length > 0
          ? { jumpsJson: JSON.stringify(dossier.jumps) }
          : {}),
        impactNote: dossier.impactNote ?? dossierViejo.impactNote,
        // La narración grabada (TTS) era del texto viejo: ya no corresponde.
        audioJson: null,
      },
    }),
    // Upsert por posición (no borrar y crear): así se conserva durationSec.
    ...payload.tracklist.map((t) => {
      const note = dossier.trackNotes.find((n) => n.position === t.position)?.note ?? null;
      return prisma.trackNote.upsert({
        where: { dossierId_position: { dossierId: dossierViejo.id, position: t.position } },
        update: { note },
        create: { dossierId: dossierViejo.id, position: t.position, title: t.title, note },
      });
    }),
    prisma.album.update({
      where: { id: album.id },
      data: { factsJson: JSON.stringify(payload) },
    }),
  ]);

  log(`Reescrita: ${titulo}`);
  return { ok: true, albumId, titulo, avisos };
}

/**
 * Una tanda: las historias publicadas que aún son de la v1, de las más vistas
 * (las que más gente lee) a las menos. Con presupuesto de tiempo para caber en
 * una ruta de Vercel (maxDuration 300).
 */
export async function reescribirTanda(opciones: {
  limite?: number;
  presupuestoMs?: number;
  log?: (msg: string) => void;
}): Promise<{ hechas: ResultadoReescritura[]; pendientes: number }> {
  const log = opciones.log ?? (() => {});
  const limite = Math.max(1, Math.min(opciones.limite ?? 3, 20));
  const fin = Date.now() + (opciones.presupuestoMs ?? 240_000);

  const candidatos = await pendientesDeReescribir();
  const hechas: ResultadoReescritura[] = [];
  for (const id of candidatos.slice(0, limite)) {
    // Cada historia tarda ~40-90 s; no empezamos una que no vaya a terminar.
    if (Date.now() > fin - 90_000) break;
    hechas.push(await reescribirHistoria(id, { log }));
  }
  const restantes = await pendientesDeReescribir();
  return { hechas, pendientes: restantes.length };
}

/** Ids de álbumes con historia publicada de la v1, más vistos primero. */
export async function pendientesDeReescribir(): Promise<string[]> {
  const albums = await prisma.album.findMany({
    where: { dossiers: { some: { locale: "es", status: "published" } } },
    select: { id: true, factsJson: true, _count: { select: { dossierViews: true, dailyPicks: true } } },
  });
  return albums
    .filter((a) => !yaReescrito(a.factsJson))
    .sort(
      (a, b) =>
        b._count.dossierViews + b._count.dailyPicks - (a._count.dossierViews + a._count.dailyPicks),
    )
    .map((a) => a.id);
}
