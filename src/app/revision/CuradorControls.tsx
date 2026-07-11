"use client";

// Controles del curador reutilizables: puntuar un disco (1-10) y ponerlo/quitarlo
// de la vitrina. Se usan en el buscador y en la lista de gestión del panel.

import { useState, useTransition } from "react";
import { ratingCaption } from "@/lib/review";
import { puntuarAlbumAdmin, toggleVitrina } from "./actions";

export function EstrellasCurador({
  albumId,
  rating,
}: {
  albumId: string;
  rating: number | null;
}) {
  const [valor, setValor] = useState<number>(rating ?? 0);
  const [hover, setHover] = useState<number>(0);
  const [pending, startTransition] = useTransition();
  const mostrado = hover || valor;

  function puntuar(n: number) {
    setValor(n);
    startTransition(async () => {
      await puntuarAlbumAdmin(albumId, n);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={pending}
            onMouseEnter={() => setHover(n)}
            onClick={() => puntuar(n)}
            aria-label={`Puntuar ${n} de 10`}
            className={`h-6 w-6 rounded-full text-[11px] font-semibold transition-colors ${
              n <= mostrado
                ? "bg-album text-black"
                : "bg-white/8 text-dim hover:bg-white/15"
            } disabled:opacity-50`}
          >
            {n}
          </button>
        ))}
      </div>
      <span className="text-xs text-dim">
        {valor > 0 ? `${valor}/10 · ${ratingCaption(valor)}` : "sin puntuar"}
      </span>
    </div>
  );
}

export function VitrinaToggle({
  albumId,
  inicial,
}: {
  albumId: string;
  inicial: boolean;
}) {
  const [enVitrina, setEnVitrina] = useState(inicial);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const r = await toggleVitrina(albumId);
      if (r.ok) setEnVitrina(r.showcase);
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={toggle}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        enVitrina
          ? "border-album/40 bg-album/15 text-album-light"
          : "border-white/15 text-foreground/80 hover:border-album/30"
      }`}
    >
      <span aria-hidden>{enVitrina ? "★" : "☆"}</span>
      {enVitrina ? "En la vitrina" : "A la vitrina"}
    </button>
  );
}
