// EL ESCALAFÓN — antes: una rejilla de carátulas cuadradas con la moneda
// dorada encima. O sea, Spotify. O sea, la plantilla.
//
// El Salón no es una parrilla de portadas: es un ESCALAFÓN, y un escalafón se
// lee en columna, numerado, con la cifra alineada a la derecha para poder
// compararla de un vistazo. Eso es lo que hace aquí `destacada`: el muro de los
// inmortales se compone como el cuadro de honor de una publicación —posición,
// carátula pequeña, título en display, puntos conductores y la cifra— en vez de
// como una galería de estampitas.
//
// La carátula no desaparece (es música, la cara importa), pero deja de ser la
// protagonista: es una viñeta al margen, del tamaño de un sello de correos.

import Link from "next/link";
import Image from "next/image";
import type { SalonAlbum } from "@/lib/canon/consulta";
import { SelloPuntaje } from "./SelloPuntaje";

export function GaleriaCanon({
  albums,
  destacada = false,
}: {
  albums: SalonAlbum[];
  /** Muro de inmortales: entrada más grande y numerada. */
  destacada?: boolean;
}) {
  if (albums.length === 0) return null;

  return (
    <ol className="border-t border-regla">
      {albums.map((a, i) => (
        <li key={a.id}>
          <Link
            href={`/salon/disco/${a.id}`}
            className="group flex items-center gap-3 border-b border-regla py-2.5 transition-colors hover:bg-tinta/[0.05]"
          >
            {/* Posición en el escalafón */}
            <span className="dato w-5 shrink-0 text-[10px] text-tinta-suave">
              {String(i + 1).padStart(2, "0")}
            </span>

            {/* La viñeta: la carátula reducida a sello de correos */}
            <span
              className={`relative shrink-0 overflow-hidden border border-regla bg-papel-alto ${
                destacada ? "h-12 w-12" : "h-9 w-9"
              }`}
            >
              {a.coverUrl ? (
                <Image
                  src={a.coverUrl}
                  alt={`Carátula de ${a.title}`}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : (
                <span className="dato flex h-full items-center justify-center text-[8px] text-tinta-suave">
                  s/c
                </span>
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span
                className={`font-serif block truncate leading-tight ${
                  destacada ? "text-[17px]" : "text-[15px]"
                }`}
              >
                {a.title}
              </span>
              <span className="dato block truncate text-[10px] uppercase tracking-[0.1em] text-tinta-suave">
                {a.artist}
                {a.year ? ` · ${a.year}` : ""}
              </span>
            </span>

            <span className="puntos hidden sm:block" />

            <SelloPuntaje score={a.score} tam={destacada ? "md" : "sm"} />
          </Link>
        </li>
      ))}
    </ol>
  );
}
