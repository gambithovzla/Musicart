"use client";

// El revelado teatral del álbum del día: como destapar un vinilo.

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ImpactoCultural } from "./ImpactoCultural";
import { DificultadEscucha } from "./DificultadEscucha";
import { ShareAlbum } from "./ShareAlbum";
import type { MadrigueraAlbum } from "@/lib/madriguera";

export type DailyAlbum = {
  albumId: string;
  title: string;
  artist: string;
  year: number;
  coverUrl: string | null;
  durationMin: number | null;
  difficulty: number;
  impact: number;
  impactNote?: string | null; // por qué este impacto (clic), sobre hechos verificados
  hook: string;
  dateLabel: string;
  reason: string | null; // "por qué este disco, para ti, hoy" (pick personalizado)
  personalized: boolean;
  showProfileInvite: boolean; // sin perfil aún: invitar a contarnos quién escucha
  returnWelcome?: boolean; // Fase 5.6: regreso tras ausencia del ritual
  madriguera: MadrigueraAlbum[]; // discos para seguir explorando al terminar
};

export function DailyReveal({ album }: { album: DailyAlbum }) {
  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col px-6 pt-12">
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <p className="text-xs uppercase tracking-[0.3em] text-dim">{album.dateLabel}</p>
        <h1 className="font-serif mt-2 text-lg italic text-album-light">
          {album.returnWelcome
            ? "Bienvenido de vuelta"
            : album.personalized
              ? "Tu álbum de hoy"
              : "El álbum de hoy"}
        </h1>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, filter: "blur(12px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto mt-8 aspect-square w-full max-w-xs overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10"
        style={{ boxShadow: "0 25px 60px -12px var(--album-dark)" }}
      >
        {album.coverUrl ? (
          <Image
            src={album.coverUrl}
            alt={`Portada de ${album.title}`}
            fill
            sizes="320px"
            priority
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-album-dark">
            <span className="font-serif text-5xl text-album-light">♪</span>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 1.1 }}
        className="mt-8 text-center"
      >
        <h2 className="font-serif text-3xl font-semibold leading-tight">
          {album.title}
        </h2>
        <p className="mt-1 text-lg text-dim">
          {album.artist} · {album.year}
        </p>

        <div className="mt-5 flex flex-wrap items-start justify-center gap-x-5 gap-y-2 text-sm text-dim">
          {album.durationMin && <span className="pt-px">{album.durationMin} min</span>}
          <DificultadEscucha value={album.difficulty} />
          <ImpactoCultural value={album.impact} note={album.impactNote} />
        </div>

        {album.reason ? (
          <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-album/30 bg-album/10 px-5 py-4">
            <p className="text-[0.65rem] uppercase tracking-[0.25em] text-album-light">
              {album.returnWelcome ? "Te guardé algo especial" : "Para ti, hoy"}
            </p>
            <p className="font-serif mt-2 text-base italic leading-relaxed text-foreground/90">
              {album.reason}
            </p>
          </div>
        ) : (
          <p className="font-serif mx-auto mt-6 max-w-sm text-base italic leading-relaxed text-foreground/90">
            “{album.hook}”
          </p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.7 }}
        className="mt-auto pb-8 pt-10"
      >
        <Link
          href={`/album/${album.albumId}`}
          className="block rounded-2xl bg-album px-6 py-4 text-center text-base font-semibold text-black shadow-lg shadow-album/30 transition-transform active:scale-[0.98]"
        >
          Descubrir este disco
        </Link>
        <div className="mt-4">
          <ShareAlbum
            albumId={album.albumId}
            title={album.title}
            artist={album.artist}
            subtitle={album.reason ?? album.hook}
          />
        </div>

        {album.madriguera.length > 0 && (
          <section className="mt-10">
            <h3 className="text-center text-xs uppercase tracking-[0.25em] text-dim">
              ¿Ya lo escuchaste? Sigue la madriguera
            </h3>
            <p className="mx-auto mt-2 max-w-xs text-center text-sm text-dim">
              El disco de hoy es la puerta. Si tienes la tarde por delante, baja
              un poco más.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              {album.madriguera.map((m) => (
                <Link
                  key={m.albumId}
                  href={`/album/${m.albumId}`}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-3 transition-transform active:scale-[0.98]"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-album-dark">
                    {m.coverUrl ? (
                      <Image
                        src={m.coverUrl}
                        alt={`Portada de ${m.title}`}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="font-serif text-xl text-album-light">♪</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-base font-semibold">
                      {m.title}
                    </p>
                    <p className="truncate text-sm text-dim">
                      {m.artist} · {m.year}
                    </p>
                    {m.connection && (
                      <p className="mt-1 line-clamp-2 text-xs italic text-foreground/70">
                        {m.connection}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <Link
          href="/explorar"
          className="mt-8 block text-center text-sm text-dim underline underline-offset-4"
        >
          Explorar rutas temáticas →
        </Link>
        {album.showProfileInvite && (
          <Link
            href="/perfil"
            className="mt-4 block text-center text-sm text-dim underline underline-offset-4"
          >
            Cuéntanos qué te gusta y el disco de hoy será para ti →
          </Link>
        )}
      </motion.div>
    </div>
  );
}
