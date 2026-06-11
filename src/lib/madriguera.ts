// La madriguera: cuando ya escuchaste el disco del día y tienes la tarde por
// delante, Musicart te abre la puerta para seguir bajando por el catálogo.
// El pick del día sigue siendo UNO y sagrado: esto es exploración, no un
// segundo ritual.
//
// No usa IA en runtime (regla: la app nunca se cae por la IA). Reutiliza los
// "saltos de descubrimiento" del dossier de hoy —ya narrados y verificados por
// el pipeline anti-alucinación— y, si no alcanzan, completa con discos vecinos
// por afinidad de etiquetas. Es determinista e instantáneo.

import { prisma } from "./db";
import { queueKey } from "./curator";
import { parseJson, type DiscoveryJump, type FactsPayload } from "./types";

export type MadrigueraAlbum = {
  albumId: string;
  title: string;
  artist: string;
  year: number;
  coverUrl: string | null;
  connection: string | null; // por qué conecta con el disco de hoy (si lo sabemos)
};

function tagsDe(factsJson: string): string[] {
  return (parseJson<Partial<FactsPayload>>(factsJson, {}).tags ?? []).map((t) =>
    t.toLowerCase().trim(),
  );
}

/**
 * Discos para seguir explorando a partir del disco de hoy.
 * Devuelve hasta `limit` álbumes ya publicados (escuchables ahora mismo).
 * Nunca lanza: ante cualquier fallo, devuelve [] y la home simplemente la omite.
 */
export async function getMadriguera(
  albumId: string,
  limit = 3,
): Promise<MadrigueraAlbum[]> {
  try {
    const hoy = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        dossiers: { where: { locale: "es", status: "published" }, take: 1 },
      },
    });
    if (!hoy) return [];

    // Catálogo escuchable ahora mismo (todo lo publicado menos el de hoy).
    const catalogo = await prisma.album.findMany({
      where: {
        dossiers: { some: { locale: "es", status: "published" } },
        id: { not: albumId },
      },
      select: {
        id: true,
        title: true,
        year: true,
        coverUrl: true,
        factsJson: true,
        artist: { select: { name: true } },
      },
    });
    if (catalogo.length === 0) return [];

    const elegidos: MadrigueraAlbum[] = [];
    const yaPuesto = new Set<string>();

    // 1) Saltos de descubrimiento del disco de hoy que ya estén publicados.
    //    Son la madriguera curada: conexión real, narrada y verificada.
    const dossier = hoy.dossiers[0];
    const jumps = dossier
      ? parseJson<DiscoveryJump[]>(dossier.jumpsJson, [])
      : [];
    for (const jump of jumps) {
      if (elegidos.length >= limit) break;
      const destino = catalogo.find(
        (a) =>
          queueKey(a.title, a.artist.name) === queueKey(jump.title, jump.artist),
      );
      if (destino && !yaPuesto.has(destino.id)) {
        elegidos.push({
          albumId: destino.id,
          title: destino.title,
          artist: destino.artist.name,
          year: destino.year,
          coverUrl: destino.coverUrl,
          connection: jump.connection,
        });
        yaPuesto.add(destino.id);
      }
    }

    // 2) Si faltan, completar con vecinos por afinidad de etiquetas.
    //    Sin conexión narrada: no inventamos una relación que no verificamos.
    if (elegidos.length < limit) {
      const tagsHoy = new Set(tagsDe(hoy.factsJson));
      const vecinos = catalogo
        .filter((a) => !yaPuesto.has(a.id))
        .map((a) => {
          const comunes = tagsDe(a.factsJson).filter((t) => tagsHoy.has(t));
          return { album: a, score: comunes.length };
        })
        .filter((v) => v.score > 0)
        .sort((x, y) => y.score - x.score);

      for (const v of vecinos) {
        if (elegidos.length >= limit) break;
        elegidos.push({
          albumId: v.album.id,
          title: v.album.title,
          artist: v.album.artist.name,
          year: v.album.year,
          coverUrl: v.album.coverUrl,
          connection: null,
        });
        yaPuesto.add(v.album.id);
      }
    }

    return elegidos.slice(0, limit);
  } catch (err) {
    console.error("[madriguera] no se pudo armar, se omite:", err);
    return [];
  }
}
