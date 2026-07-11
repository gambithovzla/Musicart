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
    };
  });
}

export async function vitrinaCount(): Promise<number> {
  return prisma.album.count({
    where: {
      showcase: true,
      dossiers: { some: { status: "published", locale: "es" } },
    },
  });
}
