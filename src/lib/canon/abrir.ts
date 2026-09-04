// Fase 9 — Abrir un disco del Salón: fabricar su dossier.
//
// El índice del canon tiene miles de discos y ninguno trae historia escrita:
// eso costaría una fortuna y meses de generación. La historia se fabrica el día
// que alguien toca ese disco, exactamente como un paso de un Camino (8.2). Y
// como muchos canónicos ya están en el catálogo, la mayoría de las veces sale
// gratis (`reused: true`) y aparece al instante.
//
// Vive en su propio archivo, aparte de `consulta.ts`, porque importar el
// pipeline arrastra jimp → `fs`: cualquier componente de cliente que tocara
// `consulta.ts` rompería el build. Mismo motivo por el que existen `caminos.ts`
// y `caminos-pasos.ts` por separado.

import { prisma } from "../db";
import { runDossierPipeline } from "../dossier/pipeline";
import { hayPresupuestoHoy, registrarGeneracion } from "../budget";

export type AbrirCanonResult =
  | { ok: true; albumId: string }
  | { ok: false; reason: "no-encontrado" | "presupuesto" | "no-verificado" | "error" };

function hoyKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Deja listo el dossier de un disco del canon y devuelve su `albumId` para
 * enlazarlo. Idempotente: si ya se fabricó, devuelve el de siempre sin gastar.
 */
export async function abrirDiscoDelCanon(
  canonId: string,
): Promise<AbrirCanonResult> {
  try {
    const canon = await prisma.canonAlbum.findUnique({ where: { id: canonId } });
    if (!canon) return { ok: false, reason: "no-encontrado" };

    // Ya fabricado: gratis y al instante.
    if (canon.albumId) return { ok: true, albumId: canon.albumId };

    // El tope de gasto diario manda también aquí: el Salón tiene miles de
    // discos y sin esta puerta una tarde de curioseo se comería el presupuesto.
    const date = hoyKey();
    if (!(await hayPresupuestoHoy(date, "extra"))) {
      return { ok: false, reason: "presupuesto" };
    }

    const result = await runDossierPipeline(canon.title, canon.artist, {
      publish: true,
    });
    if (!result.reused) await registrarGeneracion(date);

    if (result.status !== "published") {
      console.warn(
        `[salon] "${canon.title}" de ${canon.artist} no pasó verificación (quedó en borrador).`,
      );
      return { ok: false, reason: "no-verificado" };
    }

    // Guardamos el enlace para que el siguiente que llegue no pague la espera.
    // Si otro disco del canon ya reclamó ese álbum (misma obra duplicada en
    // Wikidata), el choque de unicidad no debe estropear la respuesta.
    try {
      await prisma.canonAlbum.update({
        where: { id: canonId },
        data: { albumId: result.albumId },
      });
    } catch {
      // El dossier existe igual: es lo único que el oyente necesita.
    }

    return { ok: true, albumId: result.albumId };
  } catch (err) {
    console.error("[salon] no se pudo abrir el disco:", err);
    return { ok: false, reason: "error" };
  }
}
