"use client";

// LA PORTADA DEL DÍA — antes: todo centrado, la carátula flotando con halo de
// neón, la razón dentro de una cajita ámbar redondeada y un botón en pastilla.
// O sea: la portada de cualquier app.
//
// Ahora es la PRIMERA PLANA de la edición de hoy, y está compuesta como tal:
//
//   · La carátula se presenta como una LÁMINA (un fotograbado con su marco de
//     tinta y su pie de figura numerado), no como una tarjeta con sombra.
//   · El titular va a la izquierda y enorme, no centrado. Centrar todo es de
//     presentación de diapositivas; una portada tiene eje izquierdo.
//   · La ficha técnica (duración, dificultad, impacto) es una TIRA DE DATOS
//     separada por reglas, como el pie de una ficha de catálogo.
//   · El "por qué este disco, para ti, hoy" es un DESTACADO: comilla de
//     apertura grande y regla al margen. Es la cita de la página.
//   · Escuchar no es tres pastillas con puntitos de color: es una línea de
//     pie —"ESCÚCHALO EN: Spotify · Apple Music · YT Music"— como el pie de
//     créditos de un artículo.

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ImpactoCultural } from "./ImpactoCultural";
import { DificultadEscucha } from "./DificultadEscucha";
import { ShareAlbum } from "./ShareAlbum";
import { DameOtroDisco } from "./DameOtroDisco";
import { GenreTags } from "./GenreTags";
import type { MadrigueraAlbum } from "@/lib/madriguera";
import type { AlbumLinks } from "@/lib/types";

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
  wowHook?: string | null; // Fase 6.9: curiosidad verificada tras escuchar el disco
  links?: AlbumLinks; // links de streaming directo (Spotify / Apple / YouTube Music)
  canReroll?: boolean; // oyente con perfil: puede pedir "otro" si no lo encuentra
  genres?: string[]; // etiquetas de género derivadas de las tags reales del disco
};

export function DailyReveal({ album }: { album: DailyAlbum }) {
  const tieneEnlaces =
    album.links &&
    (album.links.spotify || album.links.appleMusic || album.links.youtubeMusic);

  return (
    <div className="px-5 pb-10 pt-6">
      {/* ── Antetítulo de la edición ───────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="cabecera-seccion"
      >
        <span className="rotulo">
          {album.returnWelcome
            ? "Bienvenido de vuelta"
            : album.personalized
              ? "Tu disco de hoy"
              : "El disco de hoy"}
        </span>
        <span className="dato text-[11px] text-tinta-suave">{album.dateLabel}</span>
      </motion.header>

      {/* ── La lámina ──────────────────────────────────────────────────── */}
      <motion.figure
        initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
        animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }}
        transition={{ duration: 0.85, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="mt-6"
      >
        <div className="relative aspect-square w-full border border-tinta bg-papel-alto">
          {album.coverUrl ? (
            <Image
              src={album.coverUrl}
              alt={`Portada de ${album.title}`}
              fill
              sizes="(max-width: 512px) 100vw, 512px"
              priority
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-serif text-6xl text-album">♪</span>
            </div>
          )}
        </div>
        {/* Pie de figura: lo que convierte una imagen en una lámina. */}
        <figcaption className="dato mt-2 flex items-baseline justify-between gap-3 text-[11px] uppercase tracking-[0.1em] text-tinta-suave">
          <span className="truncate">Lám. I · {album.artist}</span>
          <span className="shrink-0">{album.year}</span>
        </figcaption>
      </motion.figure>

      {/* ── El titular ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.75 }}
      >
        <h1 className="font-serif mt-6 text-[2.6rem] font-semibold leading-[0.94]">
          {album.title}
        </h1>
        <p className="dato mt-2.5 text-[11px] uppercase tracking-[0.18em] text-tinta-suave">
          {album.artist} · {album.year}
        </p>

        {album.genres && album.genres.length > 0 && (
          <div className="mt-3">
            <GenreTags genres={album.genres} />
          </div>
        )}

        {/* Tira de datos: la ficha técnica del disco. */}
        <div className="filete mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-regla py-2.5 text-[12px] text-tinta-suave">
          {album.durationMin && (
            <span className="dato text-[11px]">{album.durationMin} min</span>
          )}
          <DificultadEscucha value={album.difficulty} />
          <ImpactoCultural value={album.impact} note={album.impactNote} />
        </div>

        {/* El destacado: la cita de la página. */}
        {album.reason ? (
          <div className="mt-6 border-l-2 border-album pl-4">
            <p className="rotulo !text-album">
              {album.returnWelcome ? "Te guardé algo especial" : "Para ti, hoy"}
            </p>
            <p className="font-serif mt-2 text-[17px] leading-snug">
              {album.reason}
            </p>
          </div>
        ) : (
          <p className="font-serif relative mt-7 pl-7 text-[19px] leading-snug">
            <span
              aria-hidden
              className="font-serif absolute left-0 top-[-0.35em] text-[3.2rem] leading-none text-album"
            >
              “
            </span>
            {album.hook}
          </p>
        )}
      </motion.div>

      {/* ── Acciones ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.15 }}
        className="mt-8"
      >
        <Link href={`/album/${album.albumId}`} className="sello w-full">
          Leer el dossier
        </Link>

        {tieneEnlaces && (
          <div className="mt-5 border-t border-regla pt-4">
            <span className="rotulo">Escúchalo en</span>
            {/* Tres destinos, tres objetivos de 48px. Antes eran tres palabras
                subrayadas de 11px: bonito de leer, imposible de acertar. */}
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {album.links?.spotify && (
                <EnlaceEscucha href={album.links.spotify}>Spotify</EnlaceEscucha>
              )}
              {album.links?.appleMusic && (
                <EnlaceEscucha href={album.links.appleMusic}>Apple</EnlaceEscucha>
              )}
              {album.links?.youtubeMusic && (
                <EnlaceEscucha href={album.links.youtubeMusic}>YT Music</EnlaceEscucha>
              )}
            </div>
          </div>
        )}

        <div className="mt-5">
          <ShareAlbum
            albumId={album.albumId}
            title={album.title}
            artist={album.artist}
            subtitle={album.reason ?? album.hook}
          />
        </div>

        {album.canReroll && <DameOtroDisco />}

        {/* ── Al margen: la curiosidad verificada ──────────────────────── */}
        {album.wowHook && (
          <aside className="mt-10 border-y border-tinta py-4">
            <p className="rotulo">Al margen</p>
            <p className="font-serif mt-2 text-[15px] leading-relaxed">
              {album.wowHook}
            </p>
            <Link
              href={`/album/${album.albumId}`}
              className="dato mt-2 inline-flex min-h-[44px] items-center text-[12px] uppercase tracking-[0.08em] underline underline-offset-4"
            >
              Más curiosidades en el dossier
            </Link>
          </aside>
        )}

        {/* ── La madriguera ────────────────────────────────────────────── */}
        {album.madriguera.length > 0 && (
          <section className="mt-10">
            <div className="cabecera-seccion">
              <span className="rotulo">Sigue la madriguera</span>
              <span className="dato text-[11px] text-tinta-suave">
                {album.madriguera.length}
              </span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-tinta-suave">
              El disco de hoy es la puerta. Si tienes la tarde por delante, baja
              un poco más.
            </p>
            <ol className="mt-4 border-t border-regla">
              {album.madriguera.map((m, i) => (
                <li key={m.albumId}>
                  <Link href={`/album/${m.albumId}`} className="fila !items-start">
                    <span className="dato w-5 shrink-0 pt-0.5 text-[11px] text-tinta-suave">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden border border-regla bg-papel-alto">
                      {m.coverUrl ? (
                        <Image
                          src={m.coverUrl}
                          alt={`Portada de ${m.title}`}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="font-serif flex h-full items-center justify-center text-lg text-album">
                          ♪
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-serif block truncate text-[17px] leading-tight">
                        {m.title}
                      </span>
                      <span className="dato block truncate text-[11px] uppercase tracking-[0.08em] text-tinta-suave">
                        {m.artist} · {m.year}
                      </span>
                      {m.connection && (
                        <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-tinta-suave">
                          {m.connection}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ── Pie de página ────────────────────────────────────────────── */}
        <div className="filete mt-10 pt-4">
          <Link
            href="/explorar"
            className="dato flex min-h-[48px] items-center text-[12px] uppercase tracking-[0.08em] underline underline-offset-4"
          >
            Explorar el resto de la publicación
          </Link>
          {album.showProfileInvite && (
            <Link
              href="/perfil"
              className="flex min-h-[48px] items-center text-[13px] leading-relaxed text-tinta-suave underline underline-offset-4"
            >
              Cuéntanos qué te gusta y el disco de hoy será para ti.
            </Link>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/** Un destino de escucha: recuadro de tinta con su medida de dedo. */
function EnlaceEscucha({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="dato pulsable flex min-h-[48px] items-center justify-center border border-tinta px-2 text-center text-[12px] uppercase tracking-[0.06em]"
    >
      {children}
    </a>
  );
}
