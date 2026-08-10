"use client";

// EL DIAL: marcas una altura (55 a 100) y te sale un disco de esa altura exacta.
// Como el puntaje está calibrado por percentil, pedir "un 95" significa siempre
// lo mismo. Responde al instante: no hay ningún LLM debajo, solo una consulta al
// índice con la afinidad de tus gustos como desempate.
//
// La composición: la cifra ocupa media pantalla, en display, como el número de
// una portada de revista. Debajo, una REGLA GRADUADA —con sus marcas cada cinco
// y sus dos extremos rotulados— en vez del slider azul de sistema. Es el mismo
// input range de siempre (accesible, arrastrable, funciona con teclado), pero
// vestido de instrumento de medición y no de control de volumen.

import { useState, useTransition } from "react";
import Link from "next/link";
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

  const pct = ((score - MIN) / (MAX - MIN)) * 100;

  return (
    <section>
      <div className="cabecera-seccion">
        <span className="rotulo">El dial</span>
        <span className="dato text-[11px] text-tinta-suave">55 — 100</span>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-tinta-suave">
        ¿Quieres un 100 de 100? ¿Un 95? Marca la altura y te doy un disco de esa
        altura exacta, elegido entre los que encajan contigo.
      </p>

      {/* La cifra, a tamaño de portada */}
      <div className="mt-6 flex items-end justify-center gap-2">
        <span className="cifra text-[7rem] font-semibold text-album">{score}</span>
        <span className="dato mb-3 text-sm text-tinta-suave">/100</span>
      </div>

      {/* La regla graduada */}
      <div className="mt-2">
        <label className="sr-only" htmlFor="dial-canon">
          Puntaje del canon
        </label>
        <div className="relative">
          {/* Las marcas: una cada punto, más alta cada cinco */}
          <div aria-hidden className="flex h-4 items-end justify-between">
            {Array.from({ length: MAX - MIN + 1 }, (_, i) => {
              const v = MIN + i;
              const mayor = v % 5 === 0;
              return (
                <span
                  key={v}
                  className={`w-px ${
                    v <= score ? "bg-tinta" : "bg-regla"
                  } ${mayor ? "h-4" : "h-2"}`}
                />
              );
            })}
          </div>
          {/* El cursor de la regla */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-1 h-3 w-[3px] bg-album"
            style={{ left: `calc(${pct}% - 1.5px)` }}
          />
          <input
            id="dial-canon"
            type="range"
            min={MIN}
            max={MAX}
            step={1}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="absolute inset-x-0 -bottom-2 h-8 w-full cursor-pointer appearance-none bg-transparent opacity-0"
          />
        </div>
        <div className="mt-3 flex justify-between border-t border-regla pt-1.5">
          <span className="dato text-[11px] uppercase tracking-[0.1em] text-tinta-suave">
            55 · Notables
          </span>
          <span className="dato text-[11px] uppercase tracking-[0.1em] text-tinta-suave">
            100 · Inmortales
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={pedir}
        disabled={pendiente}
        className="sello mt-6 w-full"
      >
        {pendiente ? "Buscando en el canon…" : `Dame un disco de ${score}`}
      </button>

      {vacio && !pendiente && (
        <p className="mt-4 text-center text-[13px] text-tinta-suave">
          Todavía no tengo discos a esa altura en el índice. Prueba con otro
          número.
        </p>
      )}

      {resultado && !pendiente && (
        <div className="mt-6 border-l-2 border-album pl-3">
          <p className="rotulo">A esa altura te doy</p>
          <Link
            href={`/salon/disco/${resultado.album.id}`}
            className="mt-2 flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            {resultado.album.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resultado.album.coverUrl}
                alt=""
                className="h-14 w-14 shrink-0 border border-regla object-cover"
              />
            ) : (
              <span className="dato flex h-14 w-14 shrink-0 items-center justify-center border border-regla text-[11px] text-tinta-suave">
                s/c
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="font-serif block truncate text-lg leading-tight">
                {resultado.album.title}
              </span>
              <span className="dato block truncate text-[11px] uppercase tracking-[0.08em] text-tinta-suave">
                {resultado.album.artist}
                {resultado.album.year ? ` · ${resultado.album.year}` : ""}
              </span>
            </span>
            <SelloPuntaje score={resultado.album.score} tam="sm" />
          </Link>
          <p className="mt-2.5 text-[13px] leading-relaxed text-tinta-suave">
            {resultado.porque}
          </p>
        </div>
      )}
    </section>
  );
}
