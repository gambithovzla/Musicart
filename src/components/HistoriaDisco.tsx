"use client";

// LA HISTORIA DESLIZABLE — el dossier contado escena a escena, a pantalla
// completa, como las historias de Instagram… pero impreso.
//
// Nace de "le falta vida" y de "las historias las veo genéricas": un dossier de
// nueve secciones plegables se lee como un expediente. Aquí cada pantalla dice
// UNA cosa, la portada del disco ocupa el fondo (con su trama de fotograbado y
// un acercamiento lento) y en las canciones suena su fragmento de 30 s.
//
// Gestos (los de siempre, para no enseñar nada nuevo):
//   · tocar a la derecha → siguiente · a la izquierda → anterior
//   · mantener pulsado → pausa · deslizar hacia abajo → cerrar
//   · teclado: ← → espacio Esc
// Respeta "reducir movimiento": sin acercamiento ni avance automático.

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { duracionMs, type Escena } from "@/lib/historia-escenas";
import type { AlbumLinks } from "@/lib/types";
import { useFragmentos, Vinilo } from "./Fragmentos";

export type HistoriaMeta = {
  albumId: string;
  title: string;
  artist: string;
  year: number;
  coverUrl: string | null;
  durationMin: number | null;
  links: AlbumLinks;
};

const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI"];

export function HistoriaDisco({
  escenas,
  meta,
  abierta,
  onCerrar,
}: {
  escenas: Escena[];
  meta: HistoriaMeta;
  abierta: boolean;
  onCerrar: () => void;
}) {
  const reducir = useReducedMotion();
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const [avance, setAvance] = useState(0); // 0-1 de la escena actual
  const [montado, setMontado] = useState(false);
  const frag = useFragmentos();
  const escena = escenas[i];
  const total = escenas.length;

  // Va en un PORTAL colgado del <body>: la página del dossier anima `clip-path`
  // (`.page-enter`), y eso crea un contexto de apilado que dejaba la cabecera y
  // la barra de pestañas POR ENCIMA de la historia por mucho z-index que pusiera.
  useEffect(() => setMontado(true), []);

  // Al abrir: desde el principio, y la página de fondo quieta.
  useEffect(() => {
    if (!abierta) return;
    setI(0);
    setAvance(0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [abierta]);

  const cerrar = useCallback(() => {
    frag?.parar();
    onCerrar();
  }, [frag, onCerrar]);

  const ir = useCallback(
    (destino: number) => {
      if (destino < 0) return;
      if (destino >= total) return cerrar();
      setI(destino);
      setAvance(0);
    },
    [total, cerrar],
  );

  // El reloj de la escena: avanza solo, salvo en pausa o en la última.
  useEffect(() => {
    if (!abierta || !escena) return;
    const dura = duracionMs(escena);
    if (!dura || reducir) return;
    let raf = 0;
    let previo = performance.now();
    let acumulado = avance * dura;
    let enviado = Math.round(avance * 100);
    const paso = (t: number) => {
      if (!pausa) acumulado += t - previo;
      previo = t;
      const a = Math.min(1, acumulado / dura);
      // Se repinta solo cuando la barra cambia de porcentaje: a 60 fps sería
      // repintar la portada entera 60 veces por segundo, y no se nota.
      const pct = Math.round(a * 100);
      if (pct !== enviado) {
        enviado = pct;
        setAvance(a);
      }
      if (a >= 1) {
        ir(i + 1);
        return;
      }
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
    // `avance` se lee solo al entrar (para reanudar tras una pausa).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, i, pausa, reducir]);

  // En las canciones suena su fragmento; al salir de ellas, se calla.
  const sonandoPos = frag?.sonando ?? null;
  useEffect(() => {
    if (!abierta || !frag) return;
    if (escena?.tipo === "cancion") {
      if (frag.disponibles.has(escena.position) && sonandoPos !== escena.position) {
        frag.alternar(escena.position);
      }
    } else if (sonandoPos !== null) {
      frag.parar();
    }
    // Solo al cambiar de escena (no cada vez que avanza el audio).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, i, frag?.disponibles]);

  // Teclado.
  useEffect(() => {
    if (!abierta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") ir(i + 1);
      else if (e.key === "ArrowLeft") ir(i - 1);
      else if (e.key === "Escape") cerrar();
      else if (e.key === " ") {
        e.preventDefault();
        setPausa((p) => !p);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [abierta, i, ir, cerrar]);

  // Gestos: toque corto = navegar · mantener = pausa · bajar = cerrar.
  const gesto = useRef<{ x: number; y: number; t: number; mantener?: ReturnType<typeof setTimeout> } | null>(null);
  const alPulsar = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("a,button")) return;
    const mantener = setTimeout(() => setPausa(true), 220);
    gesto.current = { x: e.clientX, y: e.clientY, t: Date.now(), mantener };
  };
  const alSoltar = (e: React.PointerEvent) => {
    const g = gesto.current;
    gesto.current = null;
    if (!g) return;
    clearTimeout(g.mantener);
    const dy = e.clientY - g.y;
    if (dy > 90) return cerrar();
    if (Date.now() - g.t > 220) {
      setPausa(false);
      return;
    }
    const caja = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - caja.left < caja.width * 0.32) ir(i - 1);
    else ir(i + 1);
  };

  if (!escena || !montado) return null;
  const fondoVisible = escena.tipo === "portada" ? 1 : escena.tipo === "cancion" ? 0.5 : 0.2;

  return createPortal(
    <AnimatePresence>
      {abierta && (
        <motion.div
          key="historia"
          role="dialog"
          aria-modal="true"
          aria-label={`Historia de ${meta.title}`}
          initial={reducir ? { opacity: 0 } : { clipPath: "inset(100% 0 0 0)" }}
          animate={reducir ? { opacity: 1 } : { clipPath: "inset(0% 0 0 0)" }}
          exit={reducir ? { opacity: 0 } : { clipPath: "inset(100% 0 0 0)" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[55] bg-papel-hondo"
        >
          <div
            className="relative mx-auto flex h-full max-w-lg select-none flex-col overflow-hidden"
            onPointerDown={alPulsar}
            onPointerUp={alSoltar}
            onPointerCancel={() => {
              if (gesto.current?.mantener) clearTimeout(gesto.current.mantener);
              gesto.current = null;
              setPausa(false);
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* ── El fondo: la portada, con trama y un acercamiento lento ── */}
            {meta.coverUrl && (
              <motion.div
                className="trama trama-tinta absolute inset-0"
                animate={{ opacity: fondoVisible }}
                transition={{ duration: 0.6 }}
              >
                <motion.div
                  key={i}
                  className="absolute inset-0"
                  initial={{ scale: reducir ? 1.05 : 1.04 }}
                  animate={{ scale: reducir ? 1.05 : 1.13 }}
                  transition={{ duration: reducir ? 0 : 18, ease: "linear" }}
                >
                  <Image
                    src={meta.coverUrl}
                    alt=""
                    fill
                    sizes="512px"
                    priority
                    className="object-cover"
                  />
                </motion.div>
              </motion.div>
            )}
            {/* Para que el texto se lea siempre: papel de abajo arriba. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, var(--papel-hondo) 0%, color-mix(in srgb, var(--papel-hondo) 70%, transparent) 45%, transparent 80%)",
              }}
            />

            {/* ── Cabecera: barras de avance + folio + cerrar ── */}
            <div className="relative z-10 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
              <div className="flex gap-1" aria-hidden>
                {escenas.map((_, k) => (
                  <div key={k} className="historia-barra flex-1">
                    <span
                      style={{
                        transform: `scaleX(${k < i ? 1 : k === i ? (duracionMs(escena) ? avance : 1) : 0})`,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="dato truncate text-[11px] uppercase tracking-[0.14em] text-tinta">
                  Lám. {ROMANOS[i] ?? i + 1} · {meta.artist}
                </span>
                <div className="flex shrink-0 items-center">
                  {pausa && <span className="dato mr-2 text-[11px] uppercase text-acento">En pausa</span>}
                  <button
                    type="button"
                    onClick={cerrar}
                    className="dato flex h-12 min-w-12 items-center justify-center px-2 text-[12px] uppercase tracking-[0.12em] text-tinta active:bg-tinta/10"
                    aria-label="Cerrar la historia"
                  >
                    Cerrar ✕
                  </button>
                </div>
              </div>
            </div>

            {/* ── La escena ── */}
            <div className="relative z-10 flex flex-1 flex-col justify-end px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
              <div className="max-h-[72dvh] overflow-y-auto overscroll-contain">
              {/* Sin AnimatePresence `mode="wait"`: con toques rápidos (o el
                  avance automático durante la salida) la escena se quedaba
                  CONGELADA mientras las barras seguían: el que salía esperaba
                  su animación y el nuevo no llegaba a montarse. Solo se anima la
                  entrada; la salida es inmediata. */}
              <motion.div
                key={i}
                initial={reducir ? { opacity: 0 } : { opacity: 0, clipPath: "inset(0 0 100% 0)", y: 14 }}
                animate={reducir ? { opacity: 1 } : { opacity: 1, clipPath: "inset(0 0 0% 0)", y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <ContenidoEscena escena={escena} meta={meta} alCerrar={cerrar} alReiniciar={() => ir(0)} />
              </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function ContenidoEscena({
  escena,
  meta,
  alCerrar,
  alReiniciar,
}: {
  escena: Escena;
  meta: HistoriaMeta;
  alCerrar: () => void;
  alReiniciar: () => void;
}) {
  const frag = useFragmentos();

  // El cuerpo manda: si el texto es largo, la letra baja de tamaño. Una historia
  // que hay que hacer scroll para terminar la frase es una historia mal contada.
  const cuerpo = (n: number) =>
    n > 260 ? "text-[1.12rem] leading-[1.5]" : n > 180 ? "text-[1.3rem] leading-[1.42]" : n > 110 ? "text-[1.5rem] leading-[1.35]" : "text-[1.85rem] leading-[1.18]";

  switch (escena.tipo) {
    case "portada":
      return (
        <div>
          <p className="rotulo !text-acento">La historia de un disco</p>
          <h2 className="font-serif mt-3 text-[3.1rem] font-semibold leading-[0.92]">{meta.title}</h2>
          <p className="dato mt-3 text-[12px] uppercase tracking-[0.16em] text-tinta-suave">
            {meta.artist} · {meta.year}
            {meta.durationMin ? ` · ${meta.durationMin} min` : ""}
          </p>
          <p className="dato mt-10 text-[11px] uppercase tracking-[0.14em] text-tinta-suave">
            Toca para avanzar ›
          </p>
        </div>
      );

    case "gancho":
      return (
        <p className={`font-serif relative pl-7 ${cuerpo(escena.texto.length)}`}>
          <span aria-hidden className="absolute left-0 top-[-0.2em] text-[3.4rem] leading-none text-acento">
            “
          </span>
          {escena.texto}
        </p>
      );

    case "texto":
      return (
        <div>
          <div className="cabecera-seccion">
            <span className="rotulo">{escena.rotulo}</span>
          </div>
          <p className={`font-serif mt-4 ${cuerpo(escena.texto.length)}`}>{escena.texto}</p>
        </div>
      );

    case "dato":
      return (
        <div className="recuadro p-5">
          <div className="flex items-baseline justify-between">
            <span className="rotulo !text-acento">¿Sabías que…?</span>
            <span className="dato text-[11px] text-tinta-suave">
              {String(escena.n).padStart(2, "0")} / {String(escena.de).padStart(2, "0")}
            </span>
          </div>
          <p className="font-serif mt-3 text-[1.35rem] leading-[1.35]">
            {escena.texto.replace(/^¿Sab[ií]as que\s*(…|\.\.\.)?\s*\??\s*/i, "")}
          </p>
        </div>
      );

    case "cancion": {
      const hay = frag?.disponibles.has(escena.position);
      const suena = frag?.sonando === escena.position;
      return (
        <div>
          <p className="rotulo">Canción № {String(escena.position).padStart(2, "0")}</p>
          <div className="mt-3 flex items-center gap-4">
            {hay ? (
              <button
                type="button"
                onClick={() => frag?.alternar(escena.position)}
                aria-label={suena ? "Parar el fragmento" : "Oír el fragmento"}
                className="pulsable shrink-0"
              >
                <Vinilo sonando={Boolean(suena)} progreso={suena ? (frag?.progreso ?? 0) : 0} tamaño={76} />
              </button>
            ) : null}
            <h3 className="font-serif min-w-0 text-[2rem] font-semibold leading-[1.02]">«{escena.title}»</h3>
          </div>
          <p className={`font-serif mt-5 ${cuerpo(escena.note.length)}`}>{escena.note}</p>
          {hay && (
            <p className="dato mt-3 text-[11px] uppercase tracking-[0.12em] text-tinta-suave">
              {suena ? "Sonando · 30 s de avance" : "Toca el disco para oírla"}
            </p>
          )}
        </div>
      );
    }

    case "final": {
      const enlaces = [
        meta.links.spotify && { href: meta.links.spotify, label: "Spotify" },
        meta.links.appleMusic && { href: meta.links.appleMusic, label: "Apple Music" },
        meta.links.youtubeMusic && { href: meta.links.youtubeMusic, label: "YouTube Music" },
      ].filter(Boolean) as { href: string; label: string }[];
      return (
        <div>
          <p className="rotulo !text-acento">Ahora, entero</p>
          <h2 className="font-serif mt-3 text-[2.3rem] font-semibold leading-[1]">
            {meta.durationMin ? `${meta.durationMin} minutos.` : "De la primera a la última."}
            <br />
            Sin saltar ninguna.
          </h2>
          {enlaces.length > 0 && (
            <div className="mt-6 grid grid-cols-1 gap-2">
              {enlaces.map((e) => (
                <a
                  key={e.label}
                  href={e.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dato pulsable fila-avanza flex min-h-[52px] items-center border border-tinta bg-papel-hondo px-4 text-[13px] uppercase tracking-[0.1em]"
                >
                  Escúchalo en {e.label}
                </a>
              ))}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={alCerrar} className="sello">
              Leer el dossier
            </button>
            <button type="button" onClick={alReiniciar} className="sello-hueco bg-papel-hondo">
              Otra vez
            </button>
          </div>
        </div>
      );
    }
  }
}
