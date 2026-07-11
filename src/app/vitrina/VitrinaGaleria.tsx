"use client";

// Galería premium: todas las piezas juntas, sin etiquetas, como una pared de
// museo. Cada portada va enmarcada, con luz, profundidad y una placa grabada.
// Al tocar una, se abre el visor de admiración (AlbumLightbox).

import Image from "next/image";
import { useState } from "react";
import { motion } from "framer-motion";
import type { VitrinaAlbum } from "@/lib/vitrina";
import { AlbumLightbox } from "./AlbumLightbox";

export function VitrinaGaleria({ albums }: { albums: VitrinaAlbum[] }) {
  const [activo, setActivo] = useState<VitrinaAlbum | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-x-5 gap-y-8">
        {albums.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.5), duration: 0.4, ease: "easeOut" }}
          >
            <Pieza album={a} onOpen={() => setActivo(a)} />
          </motion.div>
        ))}
      </div>

      <AlbumLightbox album={activo} onClose={() => setActivo(null)} />
    </>
  );
}

function Pieza({ album, onOpen }: { album: VitrinaAlbum; onOpen: () => void }) {
  const glow = album.palette?.vibrant ?? album.palette?.lightVibrant ?? "#c8a24a";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full text-left [perspective:900px]"
    >
      <div className="relative">
        {/* Luz de la paleta detrás del marco. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-3 rounded-3xl opacity-40 blur-2xl transition-opacity duration-500 group-hover:opacity-80"
          style={{ background: `radial-gradient(circle at 50% 35%, ${glow}, transparent 70%)` }}
        />

        {/* Marco metálico + passe-partout + portada, con profundidad. */}
        <motion.div
          whileTap={{ scale: 0.97 }}
          className="relative rounded-xl p-[2.5px] shadow-[0_18px_36px_rgba(0,0,0,0.55)] transition-transform duration-300 [transform-style:preserve-3d] group-hover:[transform:translateZ(0)_rotateX(6deg)]"
          style={{
            background:
              "linear-gradient(135deg, #e8cf8e 0%, #8a7a55 35%, #221c12 60%, #cdb26a 100%)",
          }}
        >
          <div className="rounded-[10px] bg-[#0b0908] p-1.5">
            <div className="relative aspect-square overflow-hidden rounded-md bg-white/5">
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
                <div className="flex h-full items-center justify-center text-3xl text-album-light">
                  ♪
                </div>
              )}
              {/* Reflejo de vidrio. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(150deg, rgba(255,255,255,0.28) 0%, transparent 32%, transparent 88%, rgba(255,255,255,0.06) 100%)",
                }}
              />
              {album.rating != null && (
                <span
                  className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold text-[#2a1f08]"
                  style={{
                    background:
                      "radial-gradient(circle at 35% 30%, #f4e3a8, #c8a24a 60%, #7a5c1e 100%)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.6)",
                  }}
                >
                  {album.rating}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Placa grabada. */}
        <div className="mt-3 px-1 text-center">
          <p className="font-serif truncate text-[15px] font-medium leading-tight text-foreground">
            {album.title}
          </p>
          <p className="truncate text-xs text-dim">
            {album.artist} · {album.year}
          </p>
        </div>
      </div>
    </button>
  );
}
