"use client";

// El dial del Salón: marcas una altura (55 a 100) y te sale un disco de esa
// altura exacta. Es lo que convierte una lista en un juego — y como el puntaje
// está calibrado por percentil, pedir "un 95" significa siempre lo mismo.
//
// Responde al instante: por debajo no hay ninguna llamada a un LLM, solo una
// consulta al índice con la afinidad de tus gustos como desempate.

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { DiscoDePuntaje } from "@/lib/canon/consulta";
import { pedirDiscoDePuntaje } from "./actions";
import { SelloPuntaje } from "./SelloPuntaje";

const MIN = 55;
const MAX = 100;

export function Dial({ inicial = 95 }: { inicial?: number }) {
  const [score, setScore] = useState(inicial);
  const [resultado, setResultado] = useState<DiscoDePuntaje | null>(null);
  const [vacio, setVacio] = useState(false);
  const [pendiente, startTransition] = useTransition();

  function pedir() {
    startTransition(async () => {
      const r = await pedirDiscoDePuntaje(score);
      setResultado(r);
      setVacio(r === null);
    });
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-surface p-6">
      <h2 className="font-serif text-xl font-semibold">Pide un disco por su altura</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-dim">
        ¿Quieres un 100 de 100? ¿Un 95? Marca el número y te doy uno de esa
        altura exacta, elegido entre los que encajan contigo.
      </p>

      <div className="mt-7 text-center">
        <motion.span
          key={score}
          initial={{ scale: 0.9, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="font-serif text-6xl font-semibold tabular-nums text-album-light"
        >
          {score}
        </motion.span>
        <span className="ml-1 text-lg text-dim">/100</span>
      </div>

      <label className="sr-only" htmlFor="dial-canon">
        Puntaje del canon
      </label>
      <input
        id="dial-canon"
        type="range"
        min={MIN}
        max={MAX}
        step={1}
        value={score}
        onChange={(e) => setScore(Number(e.target.value))}
        className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--album,#c9a227)]"
      />
      <div className="mt-1.5 flex justify-between text-[11px] text-dim">
        <span>{MIN} · notables</span>
        <span>{MAX} · inmortales</span>
      </div>

      <button
        type="button"
        onClick={pedir}
        disabled={pendiente}
        className="mt-6 w-full rounded-full bg-album px-6 py-3.5 text-sm font-medium text-black transition-opacity disabled:opacity-60"
      >
        {pendiente ? "Buscando en el canon…" : `Dame un disco de ${score}`}
      </button>

      <AnimatePresence mode="wait">
        {vacio && !pendiente && (
          <motion.p
            key="vacio"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-center text-sm text-dim"
          >
            Todavía no tengo discos a esa altura en el índice. Prueba con otro
            número.
          </motion.p>
        )}

        {resultado && !pendiente && (
          <motion.div
            key={resultado.album.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-5"
          >
            <Link
              href={`/salon/disco/${resultado.album.id}`}
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-3 transition-colors hover:border-album/40"
            >
              {resultado.album.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resultado.album.coverUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white/5 text-2xl">
                  🏛
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {resultado.album.title}
                </span>
                <span className="block truncate text-sm text-dim">
                  {resultado.album.artist}
                  {resultado.album.year ? ` · ${resultado.album.year}` : ""}
                </span>
              </span>
              <SelloPuntaje score={resultado.album.score} />
            </Link>
            <p className="mt-2.5 px-1 text-sm leading-relaxed text-dim">
              {resultado.porque}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
