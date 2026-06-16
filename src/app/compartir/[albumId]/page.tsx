// Página pública de tarjeta compartida: cualquiera que reciba el enlace la ve.
// No requiere autenticación. Muestra la portada, gancho e intro del dossier.

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { albumThemeStyle } from "@/lib/theme";
import { searchLinks } from "@/lib/sources/odesli";
import { parseJson, type AlbumLinks, type Palette } from "@/lib/types";
import { SharePageButton } from "./SharePageButton";

export const dynamic = "force-dynamic";

function firstSentence(text: string, maxLen = 200): string {
  const match = text.match(/^.+?[.!?…](\s|$)/);
  const sentence = (match?.[0] ?? text).trim();
  return sentence.length > maxLen ? `${sentence.slice(0, maxLen - 1)}…` : sentence;
}

async function getAlbum(id: string) {
  return prisma.album.findUnique({
    where: { id },
    include: {
      artist: true,
      dossiers: { where: { locale: "es", status: "published" } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const album = await getAlbum(albumId);
  if (!album) return { title: "Musicart" };
  const dossier = album.dossiers[0];
  const description = dossier?.intro
    ? firstSentence(dossier.intro)
    : `${album.title} de ${album.artist.name} — curaduría musical en Musicart`;
  return {
    title: `${album.title} — ${album.artist.name} · Musicart`,
    description,
    openGraph: {
      title: `${album.title} — ${album.artist.name}`,
      description,
      type: "music.album",
      images: album.coverUrl
        ? [{ url: album.coverUrl, width: 500, height: 500, alt: album.title }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${album.title} — ${album.artist.name}`,
      description,
      images: album.coverUrl ? [album.coverUrl] : [],
    },
  };
}

export default async function CompartirPage({
  params,
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  const album = await getAlbum(albumId);
  const dossier = album?.dossiers[0];
  if (!album || !dossier) notFound();

  const palette = parseJson<Palette | null>(album.paletteJson, null);
  const stored = parseJson<AlbumLinks>(album.linksJson, {});
  const fallback = searchLinks(album.title, album.artist.name);
  const links: AlbumLinks = {
    spotify: stored.spotify ?? fallback.spotify,
    appleMusic: stored.appleMusic,
    youtubeMusic: stored.youtubeMusic ?? fallback.youtubeMusic,
  };

  const hook = firstSentence(dossier.intro);

  return (
    <main style={albumThemeStyle(palette)} className="relative min-h-dvh">
      {/* Fondo teñido con la paleta del disco */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "linear-gradient(160deg, var(--album-dark) 0%, var(--background) 65%)",
          opacity: 0.95,
        }}
      />

      <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
        {/* Marca */}
        <p className="mb-12 text-xs uppercase tracking-[0.3em] text-dim">Musicart</p>

        {/* Portada con resplandor */}
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-14 -z-10 rounded-full opacity-50 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, var(--album-vibrant), transparent 70%)",
            }}
          />
          <div className="relative aspect-square w-56 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10 sm:w-64">
            {album.coverUrl ? (
              <Image
                src={album.coverUrl}
                alt={`Portada de ${album.title}`}
                fill
                sizes="256px"
                priority
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-album-dark">
                <span className="font-serif text-6xl text-album-light">♪</span>
              </div>
            )}
          </div>
        </div>

        {/* Título y artista */}
        <h1 className="font-serif mt-8 text-center text-3xl font-semibold leading-tight sm:text-4xl">
          {album.title}
        </h1>
        <p className="mt-2 text-center text-lg text-dim">
          {album.artist.name} · {album.year}
        </p>

        {/* Gancho */}
        <p className="mt-6 max-w-sm text-center text-sm leading-relaxed text-foreground/75">
          {hook}
        </p>

        {/* Plataformas */}
        {(links.spotify || links.appleMusic || links.youtubeMusic) && (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {links.spotify && (
              <a
                href={links.spotify}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-white/15 bg-surface/70 px-4 py-2.5 text-sm font-medium backdrop-blur-sm transition-transform active:scale-95"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#1DB954]" />
                Spotify
              </a>
            )}
            {links.appleMusic && (
              <a
                href={links.appleMusic}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-white/15 bg-surface/70 px-4 py-2.5 text-sm font-medium backdrop-blur-sm transition-transform active:scale-95"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#FA586A]" />
                Apple Music
              </a>
            )}
            {links.youtubeMusic && (
              <a
                href={links.youtubeMusic}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-white/15 bg-surface/70 px-4 py-2.5 text-sm font-medium backdrop-blur-sm transition-transform active:scale-95"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#FF0000]" />
                YouTube Music
              </a>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <Link
            href={`/album/${albumId}`}
            className="rounded-2xl bg-album px-8 py-4 text-sm font-semibold text-black shadow-lg transition-transform active:scale-[0.98]"
          >
            Ver el dossier completo →
          </Link>
          <SharePageButton
            title={`${album.title} — ${album.artist.name}`}
            text={`Descubre "${album.title}" de ${album.artist.name} en Musicart — un disco, una historia.`}
          />
        </div>
      </div>
    </main>
  );
}
