"use client";

// Vista "estantería": cada disco es un VINILO en su funda. Por encima asoma el
// disco negro con sus surcos y su etiqueta central (teñida con la paleta). La
// funda muestra el título en vertical con brillo de plástico. Al tocar, el
// vinilo se levanta y se abre el visor de admiración.

import { useState } from "react";
import type { VitrinaAlbum } from "@/lib/vitrina";
import { AlbumLightbox } from "./AlbumLightbox";

export function Estanteria({ albums }: { albums: VitrinaAlbum[] }) {
  const [activo, setActivo] = useState<VitrinaAlbum | null>(null);

  return (
    <>
      <div className="relative">
        <div className="flex flex-wrap items-end gap-[3px] px-1 pt-8">
          {albums.map((a) => (
            <Vinilo key={a.id} album={a} onOpen={() => setActivo(a)} />
          ))}
        </div>
        {/* Repisa de madera bajo los vinilos. */}
        <div className="h-2.5 rounded-b-sm bg-gradient-to-b from-[#4a3824] via-[#2e2314] to-[#160f08] shadow-[0_8px_18px_rgba(0,0,0,0.6)]" />
        <div className="h-1 bg-black/40" />
      </div>

      <AlbumLightbox album={activo} onClose={() => setActivo(null)} />
    </>
  );
}

function Vinilo({ album, onOpen }: { album: VitrinaAlbum; onOpen: () => void }) {
  const oscuro = album.palette?.darkVibrant ?? album.palette?.darkMuted ?? "#2a2218";
  const vivo = album.palette?.vibrant ?? album.palette?.lightVibrant ?? "#c8a24a";
  const texto = album.palette?.lightVibrant ?? "#f3eee6";

  // Grosor variable sutil: unos vinilos más gruesos que otros.
  const ancho = 34 + ((album.title.length * 7) % 12);
  // Desde el canto solo asoma la CÚPULA superior del disco (mismo ancho que la
  // funda, para no solaparse con los vecinos).
  const disco = ancho;
  const peek = Math.round(ancho * 0.5); // cuánto asoma por encima de la funda

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${album.title} — ${album.artist}`}
      className="group relative block shrink-0"
      style={{ width: ancho, height: 210 }}
    >
      {/* Disco negro con surcos, asomando por encima de la funda. */}
      <span
        aria-hidden
        className="absolute left-1/2 z-0 -translate-x-1/2 rounded-full transition-transform duration-300 ease-out group-hover:-translate-y-2"
        style={{
          top: 0,
          width: disco,
          height: disco,
          background: `repeating-radial-gradient(circle at 50% 50%, #060606 0px, #060606 1px, #1e1e1e 2.2px, #101010 3.2px)`,
          boxShadow: "0 4px 10px rgba(0,0,0,0.55)",
          // Solo se ve la cúpula superior; el resto queda tras la funda.
          clipPath: `inset(0 0 ${disco - peek}px 0)`,
        }}
      />
      {/* Brillo del disco. */}
      <span
        aria-hidden
        className="absolute left-1/2 z-0 -translate-x-1/2 rounded-full opacity-40 transition-transform duration-300 group-hover:-translate-y-2"
        style={{
          top: 0,
          width: disco,
          height: disco,
          background:
            "linear-gradient(120deg, transparent 35%, rgba(255,255,255,0.35) 48%, transparent 60%)",
          clipPath: `inset(0 0 ${disco - peek}px 0)`,
        }}
      />

      {/* Funda del vinilo. */}
      <span
        className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center overflow-hidden rounded-t-[3px] shadow-[2px_0_6px_rgba(0,0,0,0.4)] transition-transform duration-300 group-hover:-translate-y-2"
        style={{
          height: 210 - peek + 6,
          background: `linear-gradient(90deg, ${oscuro} 0%, ${vivo} 52%, ${oscuro} 100%)`,
        }}
      >
        {/* Reflejo de plástico. */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(100deg, transparent 42%, rgba(255,255,255,0.22) 50%, transparent 58%)",
          }}
        />
        <span
          aria-hidden
          className="absolute inset-y-0 left-[3px] w-px bg-white/25"
        />
        {/* Título en vertical. */}
        <span
          className="relative flex items-center justify-center gap-2 px-1 py-3"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed", color: texto }}
        >
          <span className="truncate text-[11px] font-semibold tracking-wide">
            {album.title}
          </span>
          <span className="truncate text-[9px] opacity-80">{album.artist}</span>
        </span>
      </span>
    </button>
  );
}
