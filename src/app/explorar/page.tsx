import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { THEMATIC_ROUTES, MIN_ALBUMS_RUTA } from "@/lib/thematic-routes";
import { matchRouteAlbums } from "@/lib/thematic-match";
import { deriveGenres } from "@/lib/genres";
import { parseJson, type FactsPayload } from "@/lib/types";
import { LibraryExplorer, type LibraryAlbum } from "@/components/LibraryExplorer";
import { PuertasExplorar } from "@/components/PuertasExplorar";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Explorar · Musicart",
  description:
    "Caminos, el Salón de la Fama, la vitrina, rutas temáticas y toda la biblioteca de Musicart.",
};

export default async function ExplorarPage() {
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
    },
    orderBy: { id: "desc" }, // id es cuid (ordenable por tiempo): más nuevos primero
  });

  // Solo rutas con suficientes discos reales: una colección se siente colección
  // con al menos MIN_ALBUMS_RUTA discos. Las demás se ocultan hasta que el
  // catálogo crezca (nada de rutas de relleno).
  const routes = THEMATIC_ROUTES.map((route) => {
    const matched = matchRouteAlbums(route, catalog);
    return { route, count: matched.length, preview: matched.slice(0, 3) };
  }).filter((r) => r.count >= MIN_ALBUMS_RUTA);

  // Etiquetas de género visibles: derivadas de las tags reales de cada disco
  // (ver src/lib/genres.ts), no hace falta ningún campo nuevo ni backfill.
  const libraryAlbums: LibraryAlbum[] = catalog.map((a) => ({
    id: a.id,
    title: a.title,
    year: a.year,
    coverUrl: a.coverUrl,
    artistName: a.artist.name,
    genres: deriveGenres(parseJson<Partial<FactsPayload>>(a.factsJson, {}).tags),
  }));

  return (
    <main className="px-5 pb-10 pt-8">
      <header>
        <p className="rotulo">Sumario de la edición</p>
        <h1 className="font-serif mt-3 text-[2.75rem] font-semibold leading-[0.92]">
          Explorar
        </h1>
        <div className="filete-grueso mt-4" />
        <p className="font-serif mt-4 text-[15px] leading-relaxed text-tinta-suave">
          Tu disco de hoy es uno y es sagrado. Todo lo demás está aquí: por dónde
          entrar a un género, qué consagró la historia y qué atesoro yo.
        </p>
      </header>

      <div className="mt-8">
        <PuertasExplorar />
      </div>

      <section className="mt-12">
        <div className="cabecera-seccion">
          <span className="rotulo">Rutas temáticas</span>
          <span className="dato text-[10px] text-tinta-suave">{routes.length}</span>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-tinta-suave">
          Colecciones curadas para seguir la madriguera con intención — no al azar.
        </p>
      </section>

      <div className="mt-6 flex flex-col gap-4">
        {routes.map(({ route, count, preview }) => (
          <Link
            key={route.slug}
            href={`/explorar/${route.slug}`}
            className="rounded-2xl border border-white/10 bg-surface p-5 transition-transform active:scale-[0.99]"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden>
                {route.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-serif text-xl font-medium">{route.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-dim">
                  {route.description}
                </p>
                <p className="mt-2 text-xs text-album-light">
                  {count} {count === 1 ? "disco disponible" : "discos disponibles"}
                </p>
              </div>
            </div>
            {preview.length > 0 && (
              <div className="mt-4 flex gap-2">
                {preview.map((a) => (
                  <div
                    key={a.id}
                    className="relative h-12 w-12 overflow-hidden rounded-lg"
                  >
                    {a.coverUrl ? (
                      <Image
                        src={a.coverUrl}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-white/5" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>

      {routes.length === 0 && (
        <p className="mt-8 rounded-2xl border border-white/10 bg-surface p-5 text-sm leading-relaxed text-dim">
          Las rutas se arman solas: cada una aparece cuando el catálogo reúne al
          menos {MIN_ALBUMS_RUTA} discos de un mismo mundo (un género, los de más
          impacto, los más exigentes…). Sigue descubriendo discos y se irán
          llenando. Mientras, tienes toda la biblioteca aquí abajo.
        </p>
      )}

      {/* Toda la biblioteca: cada disco que la IA ha fabricado queda guardado aquí
          (no se vuelve a generar). Aparecen todos, hasta los que no caen en una ruta. */}
      <section className="mt-12">
        <h2 className="font-serif text-2xl font-semibold">Toda la biblioteca</h2>
        <p className="mt-1 text-sm text-dim">
          {catalog.length}{" "}
          {catalog.length === 1 ? "disco fabricado" : "discos fabricados"} hasta hoy
          — del más nuevo al primero. Cada uno queda guardado para siempre.
        </p>

        {catalog.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-surface p-5 text-sm text-dim">
            Todavía no hay discos en la biblioteca. Generá tu disco de hoy y aquí
            quedará guardado.
          </p>
        ) : (
          <LibraryExplorer albums={libraryAlbums} />
        )}
      </section>
    </main>
  );
}
