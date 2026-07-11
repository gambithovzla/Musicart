"use client";

// Vista "estantería": cada disco es un lomo de vinilo, coloreado con la paleta
// de su portada, con el título y el artista en vertical. Al pasar/tocar, el lomo
// se asoma como si lo sacaras del estante. El conjunto descansa sobre una repisa.

import Link from "next/link";
import type { VitrinaAlbum } from "@/lib/vitrina";

export function Estanteria({ albums }: { albums: VitrinaAlbum[] }) {
  return (
    <div className="relative">
      <div className="flex flex-wrap items-end gap-[3px] px-1">
        {albums.map((a) => (
          <Lomo key={a.id} album={a} />
        ))}
      </div>
      {/* Repisa de madera bajo los lomos. */}
      <div className="mt-0 h-2 rounded-b-sm bg-gradient-to-b from-[#3a2c1c] to-[#1c150d] shadow-[0_6px_14px_rgba(0,0,0,0.5)]" />
    </div>
  );
}

function Lomo({ album }: { album: VitrinaAlbum }) {
  const oscuro = album.palette?.darkVibrant ?? album.palette?.darkMuted ?? "#2a2218";
  const vivo = album.palette?.vibrant ?? album.palette?.lightVibrant ?? "#c8a24a";
  const texto = album.palette?.lightVibrant ?? "#f3eee6";

  // Ancho variable sutil para que se vea como discos de distinto grosor.
  const ancho = 30 + ((album.title.length * 7) % 12);

  return (
    <Link
      href={`/album/${album.id}`}
      title={`${album.title} — ${album.artist}`}
      className="group relative block h-[200px] shrink-0 overflow-hidden rounded-t-[3px] shadow-md transition-transform duration-300 hover:-translate-y-3"
      style={{
        width: ancho,
        background: `linear-gradient(90deg, ${oscuro} 0%, ${vivo} 50%, ${oscuro} 100%)`,
      }}
    >
      {/* Brillo del canto. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/20"
      />
      <span
        className="absolute inset-0 flex items-center justify-center px-1 py-3"
        style={{
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          color: texto,
        }}
      >
        <span className="truncate text-[11px] font-semibold tracking-wide">
          {album.title}
        </span>
        <span className="mt-1 truncate text-[9px] opacity-80">{album.artist}</span>
      </span>
      {album.rating != null && (
        <span
          className="absolute inset-x-0 bottom-1 text-center text-[8px] font-bold"
          style={{ color: texto }}
        >
          {album.rating}
        </span>
      )}
    </Link>
  );
}
