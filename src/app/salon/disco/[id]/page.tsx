// Ficha de un disco del canon: el número, y sobre todo DE DÓNDE SALE.
//
// Esta página es la que sostiene toda la sección. Un ranking sin recibos es una
// opinión disfrazada de dato; aquí cada puntaje se abre y enseña las señales
// que lo produjeron, ninguna escrita por un modelo.
//
// Compuesta con la imprenta (Fase 10) al tocarla para el compartir de la 9.9:
// venía de la época de la plantilla —tarjeta con `bg-surface`, un emoji 🏛 de
// carátula ausente y todo centrado—. Ahora es una FICHA: rótulo, lámina con su
// pie, filete, el veredicto y debajo los recibos numerados.

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { getCanonAlbum, listarCanon } from "@/lib/canon/consulta";
import { pisoDe } from "@/lib/canon/score";
import { AbrirDisco } from "../../AbrirDisco";
import { Compartir } from "@/components/Compartir";
import { CuradorCanon } from "../../CuradorCanon";
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

/** Cabecera de sección con su folio, igual que en la portada del Salón. */
function Folio({ n, titulo }: { n: number; titulo: string }) {
  return (
    <div className="cabecera-seccion">
      <span className="rotulo">{titulo}</span>
      <span className="dato text-[11px] text-tinta-suave">
        № {String(n).padStart(2, "0")}
      </span>
    </div>
  );
}

export default async function DiscoDelCanonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [album, session] = await Promise.all([getCanonAlbum(id), auth()]);
  if (!album) notFound();

  const esAdmin = isAdminEmail(session?.user?.email);
  const piso = pisoDe(album.score);

  // Vecinos: discos de la misma altura, para seguir tirando del hilo.
  const vecinos = await listarCanon({
    min: Math.max(55, album.score - 1),
    max: Math.min(100, album.score + 1),
    porPagina: 9,
  });
  const otros = vecinos.albums.filter((a) => a.id !== album.id).slice(0, 6);

  return (
    <main className="px-5 pb-24 pt-8">
      <Link
        href="/salon"
        className="dato pulsable flex min-h-[44px] items-center text-[11px] uppercase tracking-[0.14em] text-tinta-suave"
      >
        ← El Salón
      </Link>

      <header className="mt-2">
        <p className="rotulo">Sección II · Ficha del canon</p>
        <div className="mt-4 flex items-start gap-4">
          {album.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={album.coverUrl}
              alt={`Carátula de ${album.title}`}
              className="recuadro h-28 w-28 shrink-0 object-cover"
            />
          ) : (
            // Sin carátula NO va un emoji: va un adorno tipográfico (regla 6).
            <div className="recuadro-tenue flex h-28 w-28 shrink-0 items-center justify-center text-3xl text-acento">
              ✻
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-[27px] font-semibold leading-[0.95]">
              {album.title}
            </h1>
            <p className="mt-2 text-[13px] leading-snug text-tinta-suave">
              {album.artist}
              {album.year ? (
                <span className="dato ml-1.5 text-[12px]">{album.year}</span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="filete-grueso mt-5" />
      </header>

      {/* El veredicto: la cifra manda, y a su lado qué significa esa altura. */}
      <section className="mt-6 flex items-center gap-4">
        <SelloPuntaje score={album.score} tam="lg" />
        <div className="min-w-0">
          <p className="rotulo">{piso.nombre}</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-tinta-suave">
            {piso.descripcion}
          </p>
        </div>
      </section>

      <section className="mt-10">
        <Folio n={1} titulo={`Por qué es un ${album.score}`} />
        {album.evidencia.length > 0 ? (
          // Los recibos van numerados: lo que se numera, se numera (regla 7).
          <ul className="mt-4 border-t border-regla">
            {album.evidencia.map((e, i) => (
              <li
                key={i}
                className="flex items-baseline gap-3 border-b border-regla py-3"
              >
                <span className="dato shrink-0 text-[11px] text-tinta-suave">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[13px] leading-relaxed">{e}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[13px] leading-relaxed text-tinta-suave">
            De este disco tengo menos rastro documental que de otros del canon.
            Está aquí, pero en sus márgenes.
          </p>
        )}
        <p className="mt-5 text-[12px] leading-relaxed text-tinta-suave">
          {album.bloqueado ? (
            <>
              Este puntaje lo puso el curador de Musicart a mano, no la fórmula.
              Las señales de arriba siguen siendo reales; el número que las
              acompaña es una decisión suya y así se dice.
            </>
          ) : (
            <>
              El puntaje no lo escribe la IA: sale de estas señales y de comparar
              este disco con todo el canon. Un {album.score} significa que está
              por encima de la mayoría de los discos del índice — siempre lo
              mismo, para cualquier disco.
            </>
          )}
        </p>
      </section>

      <div className="mt-10">
        <AbrirDisco canonId={album.id} yaFabricado={album.albumId} />
        {!album.albumId && (
          <p className="mt-3 text-[12px] leading-relaxed text-tinta-suave">
            Todavía no le he escrito su historia. Si la pides, la investigo,
            la escribo y la verifico — tarda un par de minutos.
          </p>
        )}
      </div>

      {(album.generos.length > 0 || album.country) && (
        <div className="mt-8 flex flex-wrap gap-2">
          {album.generos.map((g) => (
            <Link
              key={g}
              href={`/salon/lista?genero=${encodeURIComponent(g)}`}
              className="dato pulsable flex min-h-[44px] items-center border border-tinta px-3 text-[12px] uppercase tracking-[0.08em]"
            >
              {g}
            </Link>
          ))}
          {album.country && (
            <Link
              href={`/salon/lista?pais=${album.country}`}
              className="dato pulsable flex min-h-[44px] items-center border border-regla px-3 text-[12px] uppercase tracking-[0.08em] text-tinta-suave"
            >
              {nombrePais(album.country)}
            </Link>
          )}
        </div>
      )}

      {/* Compartir la cifra (9.9). La imagen social la pone
          `opengraph-image.tsx` de esta misma ruta: carátula, el sello del
          puntaje y su primer recibo — nunca un número suelto. */}
      <div className="filete mt-10 pt-6">
        <Compartir
          ruta={`/salon/disco/${album.id}`}
          titulo={`${album.title}, ${album.score}/100 · Musicart`}
          texto={`${album.title} de ${album.artist} es un ${album.score} de 100 en el canon. Aquí está por qué.`}
          etiqueta={`Compartir este ${album.score}`}
        />
      </div>

      {otros.length > 0 && (
        <section className="mt-12">
          <Folio n={2} titulo="A la misma altura" />
          <p className="mt-3 text-[13px] leading-relaxed text-tinta-suave">
            Otros discos que el canon pone donde este.
          </p>
          <div className="mt-4">
            <GaleriaCanon albums={otros} />
          </div>
        </section>
      )}

      {esAdmin && (
        <CuradorCanon
          canonId={album.id}
          scoreActual={album.score}
          bloqueado={album.bloqueado}
          titulo={album.title}
        />
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
