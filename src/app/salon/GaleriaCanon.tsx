// Rejilla de carátulas del Salón. Cada disco lleva su sello de puntaje encima y
// enlaza a su ficha (donde se lee por qué vale ese número y se puede pedir su
// historia completa).

import Link from "next/link";
import Image from "next/image";
import type { SalonAlbum } from "@/lib/canon/consulta";
import { SelloPuntaje } from "./SelloPuntaje";

export function GaleriaCanon({
  albums,
  destacada = false,
}: {
  albums: SalonAlbum[];
  /** Muro de inmortales: piezas más grandes y con halo dorado. */
  destacada?: boolean;
}) {
  if (albums.length === 0) return null;

  return (
    <ul
      className={`grid gap-4 ${
        destacada ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-4"
      }`}
    >
      {albums.map((a) => (
        <li key={a.id}>
          <Link
            href={`/salon/disco/${a.id}`}
            className="group block focus:outline-none"
          >
            <div
              className={`relative aspect-square overflow-hidden rounded-xl border bg-surface transition-transform group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-album ${
                destacada
                  ? "border-amber-300/30 shadow-[0_10px_40px_-18px_rgba(252,211,77,0.55)]"
                  : "border-white/10"
              }`}
            >
              {a.coverUrl ? (
                <Image
                  src={a.coverUrl}
                  alt={`Carátula de ${a.title}`}
                  fill
                  sizes="(max-width: 640px) 33vw, 200px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-2 text-center text-[11px] leading-tight text-dim">
                  {a.title}
                </div>
              )}
              <span className="absolute right-1.5 top-1.5">
                <SelloPuntaje score={a.score} tam="sm" />
              </span>
            </div>
            <p className="mt-2 truncate text-[13px] font-medium leading-tight">
              {a.title}
            </p>
            <p className="truncate text-[11px] text-dim">
              {a.artist}
              {a.year ? ` · ${a.year}` : ""}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
