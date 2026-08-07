import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { findRoute } from "@/lib/thematic-routes";
import { matchRouteAlbums } from "@/lib/thematic-match";
import { deriveGenres } from "@/lib/genres";
import { parseJson, type FactsPayload } from "@/lib/types";
import { GenreTags } from "@/components/GenreTags";
import { etiquetaImpacto } from "@/components/ImpactoCultural";
import { todayKey, pickForDate } from "@/lib/daily";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const route = findRoute(slug);
  if (!route) return { title: "Musicart" };
  return {
    title: `${route.title} · Musicart`,
    description: route.description,
  };
}

export default async function RutaTematicaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const route = findRoute(slug);
  if (!route) notFound();

  const catalog = await prisma.album.findMany({
    where: { dossiers: { some: { locale: "es", status: "published" } } },
    select: {
      id: true,
      title: true,
      year: true,
      coverUrl: true,
      impact: true,
      difficulty: true,
      factsJson: true,
      artist: { select: { name: true } },
      dossiers: {
        where: { locale: "es", status: "published" },
        select: { impactNote: true },
        take: 1,
      },
    },
    orderBy: { year: "asc" },
  });

  const albums = matchRouteAlbums(route, catalog);
  if (albums.length === 0) notFound();

  // En "hitos": destacamos UN disco del día (el "por qué marcó algo" ya
  // verificado contra hechos reales, Dossier.impactNote) — rota solo, sin IA
  // nueva, igual que el disco del día global. Si ninguno tiene su nota todavía,
  // se omite sin romper la página.
  const conNota =
    route.slug === "hitos"
      ? albums.filter((a) => a.dossiers?.[0]?.impactNote?.trim())
      : [];
  const hitoDelDia = conNota.length > 0 ? pickForDate(conNota, todayKey()) : null;

  return (
    <main className="px-6 pb-10 pt-12">
      <Link href="/explorar" className="text-sm text-dim underline underline-offset-4">
        ← Todas las rutas
      </Link>
      <header className="mt-6">
        <p className="text-3xl" aria-hidden>
          {route.emoji}
        </p>
        <h1 className="font-serif mt-2 text-3xl font-semibold">{route.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-dim">{route.description}</p>
      </header>

      {hitoDelDia && (
        <Link
          href={`/album/${hitoDelDia.id}`}
          className="mt-8 flex flex-col gap-4 rounded-3xl border border-album/25 bg-album/5 p-5 transition-transform active:scale-[0.99] sm:flex-row sm:items-center"
        >
          <div className="relative h-40 w-40 shrink-0 self-center overflow-hidden rounded-2xl sm:self-auto">
            {hitoDelDia.coverUrl ? (
              <Image
                src={hitoDelDia.coverUrl}
                alt={`Portada de ${hitoDelDia.title}`}
                fill
                sizes="160px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-album-dark">
                <span className="font-serif text-3xl text-album-light">♪</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-album-light">
              El hito de hoy
            </p>
            <p className="mt-2 font-serif text-xl font-semibold">{hitoDelDia.title}</p>
            <p className="text-sm text-dim">
              {hitoDelDia.artist.name} · {hitoDelDia.year}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-foreground/80">
              {hitoDelDia.dossiers[0].impactNote}
            </p>
            <p className="mt-3 text-xs tabular-nums text-dim">
              Impacto <span className="font-semibold text-album-light">{hitoDelDia.impact}</span>
              /100 · {etiquetaImpacto(hitoDelDia.impact ?? 50)}
            </p>
          </div>
        </Link>
      )}

      <div className="mt-8 flex flex-col gap-3">
        {albums.map((a) => (
          <Link
            key={a.id}
            href={`/album/${a.id}`}
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-surface p-4 transition-transform active:scale-[0.99]"
          >
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
              {a.coverUrl ? (
                <Image
                  src={a.coverUrl}
                  alt={`Portada de ${a.title}`}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-album-dark">
                  <span className="font-serif text-xl text-album-light">♪</span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{a.title}</p>
              <p className="truncate text-sm text-dim">
                {a.artist.name} · {a.year}
              </p>
              {route.slug === "hitos" && a.dossiers?.[0]?.impactNote && (
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-dim">
                  {a.dossiers[0].impactNote}
                </p>
              )}
              <div className="mt-1">
                <GenreTags
                  genres={deriveGenres(
                    parseJson<Partial<FactsPayload>>(a.factsJson, {}).tags,
                    1,
                  )}
                  size="xs"
                />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
