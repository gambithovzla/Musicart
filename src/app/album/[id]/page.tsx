// El dossier completo: antes → durante → escuchar → después.

import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/db";
import {
  checkDossierAccess,
  recordDossierView,
} from "@/lib/freemium";
import { getListenerIdentity } from "@/lib/identity";
import { stripeConfigured } from "@/lib/stripe";
import { albumThemeStyle } from "@/lib/theme";
import { queueKey } from "@/lib/curator";
import {
  parseJson,
  type AlbumLinks,
  type DiscoveryJump,
  type DossierAudio,
  type FactsPayload,
  type Palette,
} from "@/lib/types";
import { ImpactoCultural } from "@/components/ImpactoCultural";
import { DificultadEscucha } from "@/components/DificultadEscucha";
import { DidYouKnowSection } from "@/components/DidYouKnowSection";
import { DossierSection } from "@/components/DossierSection";
import { ListenLinks } from "@/components/ListenLinks";
import { ReflectionForm } from "@/components/ReflectionForm";
import { ShareAlbum } from "@/components/ShareAlbum";
import { Paywall } from "@/components/Paywall";
import { AlbumChat } from "@/components/AlbumChat";
import { Narrator, type NarratorSection } from "@/components/Narrator";
import { FuentesVerificadas } from "@/components/FuentesVerificadas";
import { BorrarDiscoAdmin } from "@/components/BorrarDiscoAdmin";
import { getChatQuota } from "@/lib/album-chat";

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
  const dossier = album.dossiers[0];
  const description = dossier?.intro
    ? dossier.intro.slice(0, 160) + (dossier.intro.length > 160 ? "…" : "")
    : `${album.title} de ${album.artist.name} — curaduría musical en Musicart`;
  return {
    title: `${album.title} — ${album.artist.name} · Musicart`,
    description,
    openGraph: {
      title: `${album.title} — ${album.artist.name}`,
      description,
      type: "music.album",
    },
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

  const [session, identity] = await Promise.all([auth(), getListenerIdentity()]);
  if (dossier.status !== "published" && !isAdminEmail(session?.user?.email)) {
    notFound();
  }
  const access = await checkDossierAccess(
    identity,
    album.id,
    session?.user?.email,
  );
  if (access.allowed) {
    await recordDossierView(identity, album.id);
  }

  const palette = parseJson<Palette | null>(album.paletteJson, null);
  const stripeReady = stripeConfigured();
  const links = parseJson<AlbumLinks>(album.linksJson, {});
  const facts = parseJson<FactsPayload | null>(album.factsJson, null);
  const questions = parseJson<string[]>(dossier.questionsJson, []);
  const wowFacts = parseJson<string[]>(dossier.wowFactsJson, []);
  const audio = parseJson<DossierAudio | null>(dossier.audioJson, null);
  const chatQuota = access.allowed
    ? await getChatQuota(identity, album.id, session?.user?.email)
    : null;

  // Saltos de descubrimiento: si el destino ya está publicado, se enlaza;
  // si no, la cola de generación ya lo tiene apuntado y "viene en camino".
  const jumps = parseJson<DiscoveryJump[]>(dossier.jumpsJson, []);
  const publicados =
    jumps.length > 0
      ? await prisma.album.findMany({
          where: { dossiers: { some: { locale: "es", status: "published" } } },
          select: {
            id: true,
            title: true,
            coverUrl: true,
            artist: { select: { name: true } },
          },
        })
      : [];
  const saltos = jumps.map((jump) => {
    const destino = publicados.find(
      (a) => queueKey(a.title, a.artist.name) === queueKey(jump.title, jump.artist),
    );
    return { jump, albumId: destino?.id ?? null, coverUrl: destino?.coverUrl ?? null };
  });

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
            label: "Canción por canción",
            text: notedTracks
              .map((t) => `Canción ${t.position}: ${t.title}. ${t.note}`)
              .join(" "),
            audioUrl: audio?.tracks,
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
          <div className="relative">
            {/* Resplandor cálido con el color del disco */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-8 -z-10 rounded-full opacity-50 blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, var(--album-vibrant), transparent 70%)",
              }}
            />
            <div className="relative aspect-square w-48 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
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
          </div>
          <h1 className="font-serif mt-6 text-3xl font-semibold leading-tight">
            {album.title}
          </h1>
          <p className="mt-1 text-lg text-dim">
            {album.artist.name} · {album.year}
          </p>
          <div className="mt-4 flex flex-wrap items-start gap-x-5 gap-y-2 text-sm text-dim">
            {album.durationMin && <span className="pt-px">{album.durationMin} min</span>}
            <DificultadEscucha value={album.difficulty} />
            <ImpactoCultural value={album.impact} note={dossier.impactNote} />
          </div>
        </header>

        <section className="mt-4">
          <ShareAlbum
            albumId={album.id}
            title={album.title}
            artist={album.artist.name}
            variant="link"
          />
        </section>

        {!access.allowed ? (
          <>
            <section className="mt-12">
              <SectionTitle n="01" title="La historia detrás del disco" />
              <div className="prose-dossier mt-4">
                <p>{dossier.intro.split("\n\n")[0]}</p>
              </div>
            </section>
            <Paywall
              used={access.used}
              limit={access.limit}
              hasAccount={Boolean(session?.user)}
              stripeReady={stripeReady}
            />
          </>
        ) : (
          <>
            <section className="mt-8">
              <Narrator
                sections={narratorSections}
                meta={{
                  albumTitle: album.title,
                  artistName: album.artist.name,
                  coverUrl: album.coverUrl,
                }}
              />
            </section>

            <p className="mt-10 text-center text-xs uppercase tracking-[0.3em] text-dim">
              Toca para abrir cada parte
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <DossierSection n="01" title="La historia detrás del disco" defaultOpen>
                <div className="prose-dossier">
                  {dossier.intro.split("\n\n").map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </DossierSection>
            </div>

            <div className="mt-3">
              <AlbumChat
                albumId={album.id}
                albumTitle={album.title}
                suggestedQuestions={questions.slice(0, 3)}
                initialQuota={chatQuota}
              />
            </div>

            <div className="mb-4 mt-3 flex flex-col gap-3">
              <DossierSection n="02" title={`Quién era ${album.artist.name}`}>
                <div className="prose-dossier">
                  {dossier.artistStory.split("\n\n").map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </DossierSection>

              <DossierSection n="03" title="Canción por canción">
                <p className="text-sm text-dim">
                  Dale play y vuelve aquí mientras escuchas — cada pista con su
                  contexto.
                </p>
                <ol className="mt-4 flex flex-col gap-1.5">
                  {dossier.trackNotes.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-xl border-l-2 border-album/60 bg-black/20 px-4 py-3"
                    >
                      <div className="flex items-baseline gap-3">
                        <span className="w-5 shrink-0 text-right text-sm tabular-nums text-dim">
                          {t.position}
                        </span>
                        <span className="font-medium">{t.title}</span>
                      </div>
                      {t.note ? (
                        <p className="font-serif mt-1.5 pl-8 text-[15px] italic leading-relaxed text-foreground/85">
                          {t.note}
                        </p>
                      ) : (
                        <p className="mt-1.5 pl-8 text-xs text-dim italic">
                          (Nota pendiente de regenerar este dossier)
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </DossierSection>

              <DidYouKnowSection facts={wowFacts} sectionNumber="04" />

              <DossierSection n="05" title="Escúchalo completo" accent defaultOpen>
                <p className="text-sm text-dim">
                  {album.durationMin
                    ? `Reserva ${album.durationMin} minutos. Vale la pena de principio a fin.`
                    : "Vale la pena de principio a fin."}
                </p>
                <div className="mt-4">
                  <ListenLinks links={links} />
                </div>
              </DossierSection>

              <DossierSection n="06" title="Por qué importa">
                <div className="prose-dossier">
                  {dossier.whyItMatters.split("\n\n").map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </DossierSection>

              <DossierSection n="07" title="Después de escuchar">
                <ReflectionForm
                  albumId={album.id}
                  questions={questions}
                  tracks={dossier.trackNotes.map((t) => t.title)}
                />
              </DossierSection>

              {saltos.length > 0 && (
                <DossierSection n="08" title="Sigue la madriguera">
                  <p className="text-sm text-dim">De este disco puedes saltar a…</p>
                  <div className="mt-4 flex flex-col gap-3">
                    {saltos.map(({ jump, albumId, coverUrl }) => {
                      const tarjeta = (
                        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                            {coverUrl ? (
                              <Image
                                src={coverUrl}
                                alt={`Portada de ${jump.title}`}
                                fill
                                sizes="56px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-album-dark">
                                <span className="font-serif text-xl text-album-light">♪</span>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {jump.title}{" "}
                              <span className="font-normal text-dim">· {jump.artist}</span>
                            </p>
                            <p className="font-serif mt-1 text-sm italic leading-snug text-foreground/80">
                              {jump.connection}
                            </p>
                            <p className="mt-1.5 text-xs text-dim">
                              {albumId ? "Léelo en Musicart →" : "La IA lo está preparando…"}
                            </p>
                          </div>
                        </div>
                      );
                      return albumId ? (
                        <Link
                          key={`${jump.artist}-${jump.title}`}
                          href={`/album/${albumId}`}
                          className="transition-transform active:scale-[0.99]"
                        >
                          {tarjeta}
                        </Link>
                      ) : (
                        <div key={`${jump.artist}-${jump.title}`}>{tarjeta}</div>
                      );
                    })}
                  </div>
                </DossierSection>
              )}
            </div>
          </>
        )}

        <FuentesVerificadas facts={facts} />

        {isAdminEmail(session?.user?.email) && (
          <BorrarDiscoAdmin albumId={album.id} title={album.title} />
        )}
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
