"use client";

// Visor de admiración: al tocar una pieza de la vitrina, se abre a pantalla
// completa como una obra de colección. La portada flota, se inclina en 3D al
// arrastrar/mover el dedo y un brillo holográfico la recorre. Sello dorado con
// el puntaje, canción favorita y acceso a su historia.

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import type { VitrinaAlbum } from "@/lib/vitrina";

export function AlbumLightbox({
  album,
  onClose,
}: {
  album: VitrinaAlbum | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!album) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [album, onClose]);

  return (
    <AnimatePresence>
      {album && <Visor key={album.id} album={album} onClose={onClose} />}
    </AnimatePresence>
  );
}

function Visor({ album, onClose }: { album: VitrinaAlbum; onClose: () => void }) {
  const glow = album.palette?.vibrant ?? album.palette?.lightVibrant ?? "#c8a24a";
  const glow2 = album.palette?.darkVibrant ?? album.palette?.muted ?? "#3a2f16";

  // Inclinación 3D y posición del brillo, siguiendo el dedo/cursor.
  const rx = useSpring(useMotionValue(0), { stiffness: 150, damping: 16 });
  const ry = useSpring(useMotionValue(0), { stiffness: 150, damping: 16 });
  const gx = useSpring(useMotionValue(50), { stiffness: 150, damping: 20 });
  const gy = useSpring(useMotionValue(35), { stiffness: 150, damping: 20 });

  const glare = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.45), rgba(255,255,255,0.08) 30%, transparent 55%)`;
  const holoShift = useTransform(gx, [0, 100], [-30, 30]);
  const holo = useMotionTemplate`linear-gradient(${holoShift}deg, transparent 20%, rgba(120,200,255,0.35) 38%, rgba(255,120,220,0.35) 48%, rgba(255,235,140,0.35) 58%, transparent 76%)`;

  function move(clientX: number, clientY: number, el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const px = (clientX - r.left) / r.width;
    const py = (clientY - r.top) / r.height;
    ry.set((px - 0.5) * 26);
    rx.set(-(py - 0.5) * 26);
    gx.set(px * 100);
    gy.set(py * 100);
  }
  function reset() {
    rx.set(0);
    ry.set(0);
    gx.set(50);
    gy.set(35);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center px-8"
      style={{ perspective: 1100 }}
    >
      {/* Fondo: negro profundo + luz ambiental de la paleta. */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-xl" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(60% 50% at 50% 42%, ${glow}55, transparent 70%), radial-gradient(80% 60% at 50% 100%, ${glow2}66, transparent 70%)`,
        }}
      />

      {/* Cerrar */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg text-white/80 backdrop-blur-sm"
      >
        ✕
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.86, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-[340px] flex-col items-center"
      >
        {/* La obra: portada con marco, inclinación 3D y holograma. */}
        <motion.div
          onPointerMove={(e) => move(e.clientX, e.clientY, e.currentTarget)}
          onPointerLeave={reset}
          onPointerDown={(e) => move(e.clientX, e.clientY, e.currentTarget)}
          style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
          className="relative aspect-square w-full touch-none select-none rounded-2xl p-[3px]"
        >
          {/* Marco metálico */}
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background:
                "linear-gradient(135deg, #e8cf8e 0%, #8a7a55 30%, #221c12 55%, #e8cf8e 100%)",
              boxShadow:
                "0 40px 80px rgba(0,0,0,0.7), 0 10px 30px rgba(0,0,0,0.5)",
            }}
          />
          <div className="relative h-full w-full overflow-hidden rounded-xl bg-black">
            {album.coverUrl ? (
              <Image
                src={album.coverUrl}
                alt={`${album.title} — ${album.artist}`}
                fill
                sizes="340px"
                className="object-cover"
                unoptimized
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl text-album-light">
                ♪
              </div>
            )}
            {/* Holograma + brillo que siguen la inclinación. */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 mix-blend-color-dodge"
              style={{ backgroundImage: holo, opacity: 0.5 }}
            />
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: glare }}
            />
          </div>

          {/* Sello dorado con el puntaje, en relieve. */}
          {album.rating != null && (
            <div
              className="absolute -right-3 -top-3 flex h-14 w-14 items-center justify-center rounded-full text-center"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, #f4e3a8, #c8a24a 55%, #7a5c1e 100%)",
                boxShadow:
                  "0 6px 16px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.6)",
                transform: "translateZ(40px)",
              }}
            >
              <span className="font-serif text-lg font-bold text-[#2a1f08]">
                {album.rating}
              </span>
            </div>
          )}
        </motion.div>

        {/* Placa de museo */}
        <div className="mt-7 text-center">
          <h2 className="font-serif text-2xl font-semibold leading-tight text-white">
            {album.title}
          </h2>
          <p className="mt-1 text-sm text-white/70">
            {album.artist} · {album.year}
          </p>
          {album.favoriteSong && (
            <p className="mt-3 text-sm italic text-album-light">
              ♪ {album.favoriteSong}
            </p>
          )}
          <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-white/40">
            Impacto cultural {album.impact}
          </p>

          <Link
            href={`/album/${album.id}`}
            className="mt-6 inline-block rounded-full border border-album/40 bg-album/10 px-6 py-2.5 text-sm font-medium text-album-light"
          >
            Ver su historia →
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
