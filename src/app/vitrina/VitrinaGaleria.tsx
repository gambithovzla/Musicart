"use client";

// La galería de la vitrina: carátulas de los discos que el curador atesora,
// cada una con la paleta de su propia portada como halo. Estética de colección:
// marco sutil, sello con el puntaje y, al tocar, la canción favorita del curador.

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { VitrinaAlbum } from "@/lib/vitrina";

export function VitrinaGaleria({ albums }: { albums: VitrinaAlbum[] }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {albums.map((a, i) => (
        <motion.div
          key={a.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.05, 0.5), duration: 0.4, ease: "easeOut" }}
        >
          <Carta album={a} />
        </motion.div>
      ))}
    </div>
  );
}

function Carta({ album }: { album: VitrinaAlbum }) {
  const glow = album.palette?.vibrant ?? album.palette?.lightVibrant ?? "#c8a24a";
  const borde = album.palette?.lightVibrant ?? "rgba(255,255,255,0.15)";

  return (
    <Link href={`/album/${album.id}`} className="group block">
      <div className="relative">
        {/* Halo de la paleta detrás de la portada. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-2 rounded-2xl opacity-40 blur-xl transition-opacity duration-500 group-hover:opacity-70"
          style={{ background: `radial-gradient(circle at 50% 40%, ${glow}, transparent 70%)` }}
        />
        <div
          className="relative aspect-square overflow-hidden rounded-xl border shadow-lg transition-transform duration-300 group-hover:-translate-y-1"
          style={{ borderColor: borde }}
        >
          {album.coverUrl ? (
            <Image
              src={album.coverUrl}
              alt={`${album.title} — ${album.artist}`}
              fill
              sizes="(max-width: 512px) 45vw, 240px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-white/5 p-3 text-center text-xs text-dim">
              {album.title}
            </div>
          )}

          {album.rating != null && (
            <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-album-light backdrop-blur-sm">
              ★ {album.rating}/10
            </span>
          )}
        </div>
      </div>

      <div className="mt-2.5 px-0.5">
        <p className="truncate font-medium leading-tight">{album.title}</p>
        <p className="truncate text-sm text-dim">
          {album.artist} · {album.year}
        </p>
        {album.favoriteSong && (
          <p className="mt-1 truncate text-xs italic text-dim/80">
            ♪ {album.favoriteSong}
          </p>
        )}
      </div>
    </Link>
  );
}
