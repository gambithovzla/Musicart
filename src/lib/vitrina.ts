// La vitrina del curador: los discos que el dueño (admin) atesora y exhibe.
// Una galería pública de carátulas favoritas, con la paleta de cada portada y
// el puntaje que el curador les dio. Los favoritos se marcan a mano desde el
// panel /revision (Album.showcase); aquí solo se leen para mostrarlos bonito.

import { prisma } from "@/lib/db";
import { adminEmails, isAdminEmail } from "@/lib/admin";
import { parseJson, type Palette } from "@/lib/types";
import { FAVORITE_KEY } from "@/lib/review";

export type VitrinaAlbum = {
  id: string;
  title: string;
  artist: string;
  year: number;
  coverUrl: string | null;
  palette: Palette | null;
  impact: number;
  /** Puntaje que el curador le dio (1-10) o null si aún no lo puntuó. */
  rating: number | null;
  /** Canción favorita del curador para este disco, si la anotó. */
  favoriteSong: string | null;
  /** Estante temático al que pertenece en la vitrina, o null. */
  shelf: string | null;
};

export type VitrinaEstante = {
  /** Nombre del estante, o null para "el resto de la colección". */
  shelf: string | null;
  albums: VitrinaAlbum[];
};

/**
 * Discos en la vitrina, ordenados por cuándo se pusieron (lo más reciente
 * primero). Solo entra lo que tiene dossier publicado —si un disco salió del
 * catálogo, no aparece rota. Incluye el puntaje del curador (la reseña de
 * cualquier admin) para exhibirlo como sello de colección.
 */
export async function getVitrinaAlbums(): Promise<VitrinaAlbum[]> {
  const albums = await prisma.album.findMany({
    where: {
      showcase: true,
      dossiers: { some: { status: "published", locale: "es" } },
    },
    include: { artist: true },
    orderBy: [{ showcaseAt: "desc" }, { title: "asc" }],
  });
  if (albums.length === 0) return [];

  // Puntaje del curador: reseñas de cualquier admin sobre estos discos. La
  // vitrina es de pocos discos, así que traemos sus reseñas y filtramos por
  // correo admin (robusto ante mayúsculas/variantes de ADMIN_EMAILS).
  const emails = adminEmails();
  const ratingByAlbum = new Map<string, { rating: number; favoriteSong: string | null }>();
  if (emails.length > 0) {
    const reviews = await prisma.review.findMany({
      where: { albumId: { in: albums.map((a) => a.id) }, userId: { not: null } },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
    });
    for (const r of reviews) {
      if (!isAdminEmail(r.user?.email)) continue;
      if (ratingByAlbum.has(r.albumId)) continue; // el más reciente gana
      const answers = parseJson<Record<string, string>>(r.answersJson, {});
      ratingByAlbum.set(r.albumId, {
        rating: r.rating,
        favoriteSong: answers[FAVORITE_KEY]?.trim() || null,
      });
    }
  }

  return albums.map((a) => {
    const curador = ratingByAlbum.get(a.id);
    return {
      id: a.id,
      title: a.title,
      artist: a.artist.name,
      year: a.year,
      coverUrl: a.coverUrl,
      palette: a.paletteJson ? parseJson<Palette | null>(a.paletteJson, null) : null,
      impact: a.impact,
      rating: curador?.rating ?? null,
      favoriteSong: curador?.favoriteSong ?? null,
      shelf: a.showcaseShelf?.trim() || null,
    };
  });
}

/**
 * La vitrina agrupada en estantes temáticos. Los estantes con nombre van
 * primero (ordenados por la adición más reciente); los discos sin estante caen
 * en un grupo final (shelf=null). Si nada tiene estante, devuelve un solo grupo
 * sin nombre (la galería se muestra plana como siempre).
 */
export async function getVitrinaEstantes(): Promise<VitrinaEstante[]> {
  const albums = await getVitrinaAlbums();
  if (albums.length === 0) return [];

  const conNombre = new Map<string, VitrinaAlbum[]>();
  const sinNombre: VitrinaAlbum[] = [];
  for (const a of albums) {
    if (a.shelf) {
      const lista = conNombre.get(a.shelf) ?? [];
      lista.push(a);
      conNombre.set(a.shelf, lista);
    } else {
      sinNombre.push(a);
    }
  }

  // Los álbumes ya vienen ordenados por showcaseAt desc; el primero de cada
  // estante es su adición más reciente, así que el orden de inserción del Map
  // (primer álbum visto) refleja "estante tocado más recientemente primero".
  const estantes: VitrinaEstante[] = [...conNombre.entries()].map(
    ([shelf, list]) => ({ shelf, albums: list }),
  );
  if (sinNombre.length > 0) {
    estantes.push({ shelf: null, albums: sinNombre });
  }
  return estantes;
}

/** Nombres de estantes existentes (para el datalist del panel). */
export async function getEstantesExistentes(): Promise<string[]> {
  const rows = await prisma.album.findMany({
    where: { showcase: true, showcaseShelf: { not: null } },
    select: { showcaseShelf: true },
    distinct: ["showcaseShelf"],
    orderBy: { showcaseShelf: "asc" },
  });
  return rows
    .map((r) => r.showcaseShelf?.trim())
    .filter((s): s is string => !!s);
}

export async function vitrinaCount(): Promise<number> {
  return prisma.album.count({
    where: {
      showcase: true,
      dossiers: { some: { status: "published", locale: "es" } },
    },
  });
}
