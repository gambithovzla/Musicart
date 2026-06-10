// El dossier completo: antes → durante → escuchar → después.

import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { albumThemeStyle } from "@/lib/theme";
import { parseJson, type AlbumLinks, type DossierAudio, type Palette } from "@/lib/types";
import { Stars } from "@/components/Stars";
import { ListenLinks } from "@/components/ListenLinks";
import { ReflectionForm } from "@/components/ReflectionForm";
import { Narrator, type NarratorSection } from "@/components/Narrator";

export const dynamic = "force-dynamic";

async function getAlbum(id: string) {
  return prisma.album.findUnique({
    where: { id },
    include: {
      artist: true,
      dossiers: {
        where: { locale: "es" },
        include: { trackNotes: { orderBy: { position: "asc" } } },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const album = await getAlbum(id);
  if (!album) return { title: "Musicart" };
  return {
    title: `${album.title} — ${album.artist.name} · Musicart`,
  };
}

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const album = await getAlbum(id);
  const dossier = album?.dossiers[0];
  if (!album || !dossier) notFound();

  const palette = parseJson<Palette | null>(album.paletteJson, null);
  const links = parseJson<AlbumLinks>(album.linksJson, {});
  const questions = parseJson<string[]>(dossier.questionsJson, []);
  const audio = parseJson<DossierAudio | null>(dossier.audioJson, null);

  const notedTracks = dossier.trackNotes.filter((t) => t.note);
  const narratorSections: NarratorSection[] = [
    {
      id: "intro",
      label: "La historia detrás del disco",
      text: dossier.intro,
      audioUrl: audio?.intro,
    },
    {
      id: "artist",
      label: `Quién era ${album.artist.name}`,
      text: dossier.artistStory,
      audioUrl: audio?.artistStory,
    },
    ...(notedTracks.length > 0
      ? [
          {
            id: "tracks",
            label: "Las canciones clave",
            text: notedTracks
              .map((t) => `Canción ${t.position}: ${t.title}. ${t.note}`)
              .join(" "),
          },
        ]
      : []),
    {
      id: "why",
      label: "Por qué importa",
      text: dossier.whyItMatters,
      audioUrl: audio?.whyItMatters,
    },
  ];

  return (
    <main style={albumThemeStyle(palette)} className="relative">
      {/* Fondo teñido con la paleta del disco */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[60dvh]"
        style={{
          background:
            "linear-gradient(to bottom, var(--album-dark) 0%, transparent 100%)",
          opacity: 0.5,
        }}
      />

      <div className="relative px-6 pt-10">
        {/* — Hero — */}
        <header className="flex flex-col items-center text-center">
          <div className="relative aspect-square w-48 overflow-hidden rounded-xl shadow-2xl">
            {album.coverUrl ? (
              <Image
                src={album.coverUrl}
                alt={`Portada de ${album.title}`}
                fill
                sizes="192px"
                priority
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-album-dark">
                <span className="font-serif text-4xl text-album-light">♪</span>
              </div>
            )}
          </div>
          <h1 className="font-serif mt-6 text-3xl font-semibold leading-tight">
            {album.title}
          </h1>
          <p className="mt-1 text-lg text-dim">
            {album.artist.name} · {album.year}
          </p>
          <div className="mt-4 flex items-center gap-5 text-sm text-dim">
            {album.durationMin && <span>{album.durationMin} min</span>}
            <span>
              Dificultad <Stars value={album.difficulty} />
            </span>
            <span>
              Impacto <Stars value={album.impact} />
            </span>
          </div>
        </header>

        {/* — Narración por voz — */}
        <section className="mt-8">
          <Narrator sections={narratorSections} />
        </section>

        {/* — Antes de escuchar — */}
        <section className="mt-12">
          <SectionTitle n="01" title="La historia detrás del disco" />
          <div className="prose-dossier mt-4">
            {dossier.intro.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <SectionTitle n="02" title={`Quién era ${album.artist.name}`} />
          <div className="prose-dossier mt-4">
            {dossier.artistStory.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {/* — Durante la escucha — */}
        <section className="mt-12">
          <SectionTitle n="03" title="Las canciones" />
          <p className="mt-2 text-sm text-dim">
            Dale play y vuelve aquí cuando llegues a las marcadas.
          </p>
          <ol className="mt-5 flex flex-col gap-1.5">
            {dossier.trackNotes.map((t) => (
              <li
                key={t.id}
                className={
                  t.note
                    ? "rounded-xl border-l-2 border-album bg-surface px-4 py-3"
                    : "px-4 py-1.5"
                }
              >
                <div className="flex items-baseline gap-3">
                  <span className="w-5 shrink-0 text-right text-sm tabular-nums text-dim">
                    {t.position}
                  </span>
                  <span className={t.note ? "font-medium" : "text-foreground/80"}>
                    {t.title}
                  </span>
                </div>
                {t.note && (
                  <p className="font-serif mt-1.5 pl-8 text-[15px] italic leading-relaxed text-foreground/85">
                    {t.note}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* — Escuchar — */}
        <section className="mt-12">
          <SectionTitle n="04" title="Escúchalo completo" />
          <p className="mt-2 text-sm text-dim">
            {album.durationMin
              ? `Reserva ${album.durationMin} minutos. Vale la pena de principio a fin.`
              : "Vale la pena de principio a fin."}
          </p>
          <div className="mt-5">
            <ListenLinks links={links} />
          </div>
        </section>

        {/* — Por qué importa — */}
        <section className="mt-12">
          <SectionTitle n="05" title="Por qué importa" />
          <div className="prose-dossier mt-4">
            {dossier.whyItMatters.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {/* — Después de escuchar — */}
        <section className="mb-16 mt-12">
          <SectionTitle n="06" title="Después de escuchar" />
          <div className="mt-5">
            <ReflectionForm albumId={album.id} questions={questions} />
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <h2 className="flex items-baseline gap-3 border-b border-white/10 pb-3">
      <span className="text-xs tabular-nums tracking-widest text-album">{n}</span>
      <span className="font-serif text-xl font-medium">{title}</span>
    </h2>
  );
}
