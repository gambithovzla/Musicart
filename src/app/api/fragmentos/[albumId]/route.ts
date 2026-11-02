// Fragmentos de 30 s de las canciones de un disco, para oírlo DENTRO de la app.
//
// Musicart siempre mandaba a escuchar fuera (Spotify, Apple, YouTube): el
// dossier se leía en silencio. Esto empareja los avances gratuitos de iTunes
// con el tracklist publicado (por título, y si no, por posición) y los
// devuelve cacheados un día. Si iTunes no tiene el disco, devuelve [] y la UI
// simplemente no enseña los botones: nunca es un error para el oyente.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseJson, type AlbumLinks } from "@/lib/types";
import {
  collectionIdDeEnlace,
  getItunesPreviews,
  searchAlbum,
  type ItunesPreview,
} from "@/lib/sources/itunes";

export const revalidate = 86400;

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)|\[.*?\]|-\s*(remaster|live|en vivo|version|mono|stereo).*$/gi, "")
    .replace(/[^a-z0-9]/g, "");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const { albumId } = await params;
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: {
      title: true,
      linksJson: true,
      artist: { select: { name: true } },
      dossiers: {
        where: { locale: "es" },
        select: { trackNotes: { select: { position: true, title: true }, orderBy: { position: "asc" } } },
      },
    },
  });
  if (!album) return NextResponse.json({ fragmentos: [] }, { status: 404 });

  const links = parseJson<AlbumLinks>(album.linksJson, {});
  let collectionId = collectionIdDeEnlace(links.appleMusic);
  if (!collectionId) {
    const encontrado = await searchAlbum(album.title, album.artist.name).catch(() => null);
    collectionId = encontrado?.collectionId ?? null;
  }
  const avances: ItunesPreview[] = collectionId ? await getItunesPreviews(collectionId) : [];

  const pistas = album.dossiers[0]?.trackNotes ?? [];
  const porTitulo = new Map(avances.map((a) => [norm(a.title), a]));
  const usados = new Set<string>();
  const fragmentos = pistas
    .map((p) => {
      const n = norm(p.title);
      const porNombre =
        porTitulo.get(n) ??
        avances.find((a) => {
          const m = norm(a.title);
          return n.length > 3 && m.length > 3 && (m.includes(n) || n.includes(m));
        });
      // Por posición solo si el número de pistas coincide: si no, el "3" de
      // iTunes puede ser otra canción y sonaría lo que no es.
      const porPosicion =
        !porNombre && avances.length === pistas.length
          ? avances.find((a) => a.position === p.position)
          : undefined;
      const a = porNombre ?? porPosicion;
      if (!a || usados.has(a.url)) return null;
      usados.add(a.url);
      return { position: p.position, title: p.title, url: a.url };
    })
    .filter((x): x is { position: number; title: string; url: string } => Boolean(x));

  return NextResponse.json(
    { fragmentos },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
