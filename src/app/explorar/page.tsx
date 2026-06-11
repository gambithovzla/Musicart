import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { THEMATIC_ROUTES } from "@/lib/thematic-routes";
import { matchRouteAlbums } from "@/lib/thematic-match";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Explorar rutas · Musicart",
  description: "Colecciones temáticas de discos para seguir la madriguera.",
};

export default async function ExplorarPage() {
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

  const routes = THEMATIC_ROUTES.map((route) => {
    const matched = matchRouteAlbums(route, catalog);
    return { route, count: matched.length, preview: matched.slice(0, 3) };
  }).filter((r) => r.count > 0);

  return (
    <main className="px-6 pb-10 pt-12">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-dim">Explorar</p>
        <h1 className="font-serif mt-2 text-3xl font-semibold">Rutas temáticas</h1>
        <p className="mt-3 text-sm leading-relaxed text-dim">
          Colecciones curadas para seguir la madriguera con intención — no al azar.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-4">
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
        <p className="mt-12 text-center text-sm text-dim">
          El catálogo aún crece — vuelve pronto para ver las rutas.
        </p>
      )}
    </main>
  );
}
