// Ficha de un disco del canon: el número, y sobre todo DE DÓNDE SALE.
//
// Esta página es la que sostiene toda la sección. Un ranking sin recibos es una
// opinión disfrazada de dato; aquí cada puntaje se abre y enseña las señales
// que lo produjeron, ninguna escrita por un modelo.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCanonAlbum, listarCanon } from "@/lib/canon/consulta";
import { pisoDe } from "@/lib/canon/score";
import { AbrirDisco } from "../../AbrirDisco";
import { GaleriaCanon } from "../../GaleriaCanon";
import { SelloPuntaje } from "../../SelloPuntaje";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const album = await getCanonAlbum(id);
  if (!album) return { title: "El Salón de la Fama · Musicart" };
  return {
    title: `${album.title}, ${album.score}/100 · Musicart`,
    description: `Por qué ${album.title} de ${album.artist} es un ${album.score} de 100 en el canon.`,
  };
}

export default async function DiscoDelCanonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const album = await getCanonAlbum(id);
  if (!album) notFound();

  const piso = pisoDe(album.score);

  // Vecinos: discos de la misma altura, para seguir tirando del hilo.
  const vecinos = await listarCanon({
    min: Math.max(55, album.score - 1),
    max: Math.min(100, album.score + 1),
    porPagina: 9,
  });
  const otros = vecinos.albums.filter((a) => a.id !== album.id).slice(0, 6);

  return (
    <main className="px-6 pb-16 pt-14">
      <Link
        href="/salon"
        className="text-xs uppercase tracking-[0.3em] text-dim underline-offset-4 hover:underline"
      >
        ← El Salón
      </Link>

      <header className="mt-6 flex flex-col items-center text-center">
        {album.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={album.coverUrl}
            alt={`Carátula de ${album.title}`}
            className="h-44 w-44 rounded-2xl object-cover shadow-[0_20px_60px_-25px_rgba(0,0,0,0.9)]"
          />
        ) : (
          <div className="flex h-44 w-44 items-center justify-center rounded-2xl border border-white/10 bg-surface text-4xl">
            🏛
          </div>
        )}

        <h1 className="font-serif mt-6 text-3xl font-semibold leading-tight">
          {album.title}
        </h1>
        <p className="mt-1.5 text-dim">
          {album.artist}
          {album.year ? ` · ${album.year}` : ""}
        </p>

        <div className="mt-7 flex flex-col items-center">
          <SelloPuntaje score={album.score} tam="lg" />
          <p className="mt-3 text-xs uppercase tracking-[0.25em] text-album-light">
            {piso.nombre}
          </p>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-dim">
            {piso.descripcion}
          </p>
        </div>
      </header>

      <section className="mt-9 rounded-3xl border border-white/10 bg-surface p-6">
        <h2 className="font-serif text-lg font-semibold">
          Por qué es un {album.score}
        </h2>
        {album.evidencia.length > 0 ? (
          <ul className="mt-4 space-y-2.5">
            {album.evidencia.map((e, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-album" />
                <span className="text-foreground/85">{e}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-dim">
            De este disco tengo menos rastro documental que de otros del canon.
            Está aquí, pero en sus márgenes.
          </p>
        )}
        <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-dim">
          El puntaje no lo escribe la IA: sale de estas señales y de comparar
          este disco con todo el canon. Un {album.score} significa que está por
          encima de la mayoría de los discos del índice — siempre lo mismo, para
          cualquier disco.
        </p>
      </section>

      <div className="mt-8">
        <AbrirDisco canonId={album.id} yaFabricado={album.albumId} />
        {!album.albumId && (
          <p className="mt-3 text-center text-xs leading-relaxed text-dim">
            Todavía no le he escrito su historia. Si la pides, la investigo,
            la escribo y la verifico — tarda un par de minutos.
          </p>
        )}
      </div>

      {(album.generos.length > 0 || album.country) && (
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {album.generos.map((g) => (
            <Link
              key={g}
              href={`/salon/lista?genero=${encodeURIComponent(g)}`}
              className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-foreground/75"
            >
              {g}
            </Link>
          ))}
          {album.country && (
            <Link
              href={`/salon/lista?pais=${album.country}`}
              className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-foreground/75"
            >
              {nombrePais(album.country)}
            </Link>
          )}
        </div>
      )}

      {otros.length > 0 && (
        <section className="mt-12">
          <h2 className="font-serif text-lg font-semibold">A la misma altura</h2>
          <p className="mt-1.5 text-sm text-dim">
            Otros discos que el canon pone donde este.
          </p>
          <div className="mt-5">
            <GaleriaCanon albums={otros} />
          </div>
        </section>
      )}
    </main>
  );
}

function nombrePais(code: string): string {
  try {
    return new Intl.DisplayNames(["es"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
