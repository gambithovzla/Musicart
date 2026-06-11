import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { findRoute } from "@/lib/thematic-routes";
import { matchRouteAlbums } from "@/lib/thematic-match";

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
      artist: { select: { name: true } },
    },
    orderBy: { year: "asc" },
  });

  const albums = matchRouteAlbums(route, catalog);
  if (albums.length === 0) notFound();

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
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
