"use server";

// Fase 9.7 — La curaduría del canon: donde manda el criterio del dueño y no la
// fórmula.
//
// El puntaje calculado es bueno para ordenar mil discos, pero la cima es
// justamente donde un error se ve más y donde el criterio de un melómano vale
// más que cualquier señal. Por eso el club de los 100 se puede fijar a mano:
// `locked` congela el puntaje y la ingesta deja de tocarlo, para siempre, hasta
// que lo sueltes.
//
// También se puede AÑADIR un disco que el índice no trajo. Hace falta de
// verdad: Wikidata sobre-representa al mundo anglosajón, así que un clásico
// venezolano o un disco de flamenco pueden quedarse fuera aunque merezcan estar.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { searchAlbums } from "@/lib/sources/deezer";
import { canonKey, recalibrar, enlazarConCatalogo } from "@/lib/canon/ingest";

export type ResultadoCurador = { ok: boolean; error?: string; canonId?: string };

function limpiarPuntaje(score: number): number {
  return Math.min(100, Math.max(55, Math.round(Number(score))));
}

function refrescar(canonId?: string) {
  revalidatePath("/salon");
  revalidatePath("/salon/lista");
  revalidatePath("/revision");
  if (canonId) revalidatePath(`/salon/disco/${canonId}`);
}

/**
 * Fija el puntaje de un disco a mano y lo congela. A partir de aquí la ingesta
 * no lo recalcula: es tu número, no el de la fórmula.
 */
export async function fijarPuntajeCanon(
  canonId: string,
  score: number,
): Promise<ResultadoCurador> {
  try {
    await requireAdmin();
    const existe = await prisma.canonAlbum.findUnique({
      where: { id: canonId },
      select: { id: true },
    });
    if (!existe) return { ok: false, error: "Ese disco no está en el índice." };

    await prisma.canonAlbum.update({
      where: { id: canonId },
      data: { score: limpiarPuntaje(score), locked: true },
    });
    refrescar(canonId);
    return { ok: true, canonId };
  } catch (err) {
    console.error("[salon/admin] fijarPuntajeCanon:", err);
    return { ok: false, error: "No se pudo fijar el puntaje." };
  }
}

/**
 * Suelta un puntaje fijado: vuelve a mandar la fórmula. Recalibra el índice
 * entero para que este disco recupere el lugar que le toca por sus datos.
 */
export async function soltarPuntajeCanon(
  canonId: string,
): Promise<ResultadoCurador> {
  try {
    await requireAdmin();
    await prisma.canonAlbum.update({
      where: { id: canonId },
      data: { locked: false },
    });
    await recalibrar();
    refrescar(canonId);
    return { ok: true, canonId };
  } catch (err) {
    console.error("[salon/admin] soltarPuntajeCanon:", err);
    return { ok: false, error: "No se pudo soltar el puntaje." };
  }
}

/**
 * Mete a mano un disco en el canon con el puntaje que tú digas. Nace `locked`
 * porque no tiene señales propias: si lo soltaras sin más, la fórmula lo
 * mandaría al fondo por falta de datos, no por falta de méritos.
 */
export async function anadirAlCanon(
  title: string,
  artist: string,
  score: number,
): Promise<ResultadoCurador> {
  try {
    await requireAdmin();
    const t = title.trim();
    const a = artist.trim();
    if (!t || !a) return { ok: false, error: "Faltan el disco y el artista." };

    const key = canonKey(t, a);
    const yaEsta = await prisma.canonAlbum.findUnique({ where: { key } });
    if (yaEsta) {
      // No duplicamos: le ponemos el puntaje que pediste al que ya existe.
      return fijarPuntajeCanon(yaEsta.id, score);
    }

    // Carátula y año, si Deezer los tiene. Que falten no impide entrar.
    let coverUrl: string | null = null;
    try {
      const [mejor] = await searchAlbums(`${a} ${t}`, 1);
      coverUrl = mejor?.cover ?? null;
    } catch {
      // Sin portada se ve peor, pero el disco entra igual.
    }

    const creado = await prisma.canonAlbum.create({
      data: {
        key,
        title: t,
        artist: a,
        coverUrl,
        score: limpiarPuntaje(score),
        raw: 0,
        locked: true,
        evidenceJson: JSON.stringify([
          "Lo puso aquí el curador de Musicart, a mano y a conciencia",
        ]),
      },
    });

    // Por si ese disco ya tenía dossier en el catálogo.
    await enlazarConCatalogo();
    refrescar(creado.id);
    return { ok: true, canonId: creado.id };
  } catch (err) {
    console.error("[salon/admin] anadirAlCanon:", err);
    return { ok: false, error: "No se pudo añadir el disco al canon." };
  }
}

/** Saca un disco del índice (se coló, está duplicado o no es un álbum). */
export async function quitarDelCanon(canonId: string): Promise<ResultadoCurador> {
  try {
    await requireAdmin();
    await prisma.canonAlbum.delete({ where: { id: canonId } });
    refrescar();
    return { ok: true };
  } catch (err) {
    console.error("[salon/admin] quitarDelCanon:", err);
    return { ok: false, error: "No se pudo quitar el disco." };
  }
}
