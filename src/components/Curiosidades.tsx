"use client";

// Lo que le has contestado a la pregunta del día — con su fecha, y con el botón
// de que se te olvide.
//
// Nace de un problema real del dueño: contestó UNA vez a un "¿montaña o playa?"
// y meses después el curador le seguía escribiendo escenas de montaña. Aparte de
// que ahora esas respuestas caducan solas (`src/lib/curiosities.ts`), el oyente
// tiene que PODER VER de qué se está agarrando el curador y quitarlo. Sin esto,
// la única salida era borrar el perfil entero.

import { useEffect, useState, useTransition } from "react";
import {
  listarCuriosidades,
  olvidarCuriosidad,
  type CuriosidadGuardada,
} from "@/app/actions";

export function Curiosidades() {
  const [lista, setLista] = useState<CuriosidadGuardada[] | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelado = false;
    listarCuriosidades().then((r) => {
      if (!cancelado) setLista(r);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  // Sin respuestas todavía no hay nada que enseñar (ni que explicar).
  if (!lista || lista.length === 0) return null;

  const clave = (c: CuriosidadGuardada) => `${c.id}|${c.date}`;
  const vigentes = lista.filter((c) => c.vigente).length;
  const visibles = abierto ? lista : lista.slice(0, 3);

  function olvidar(c: CuriosidadGuardada) {
    setBorrando(clave(c));
    startTransition(async () => {
      const r = await olvidarCuriosidad(c.id, c.date);
      if (r.ok) {
        setLista((prev) => prev?.filter((x) => clave(x) !== clave(c)) ?? null);
      }
      setBorrando(null);
    });
  }

  return (
    <section className="mt-10">
      <div className="cabecera-seccion">
        <h2 className="rotulo">Lo que me has contado</h2>
        <span className="dato text-xs text-dim">
          {vigentes} en uso · {lista.length} guardadas
        </span>
      </div>

      <p className="mt-3 text-sm text-dim">
        Tus respuestas a la pregunta del día. Son la foto de UN día, no un rasgo
        tuyo: pasadas unas semanas dejan de pesar solas, y a los cuatro meses el
        curador ya no las mira. Si alguna se te quedó pegada —eso que respondiste
        una vez y ya no te representa— bórrala y deja de contar hoy mismo.
      </p>

      <ul className="mt-4">
        {visibles.map((c) => (
          <li
            key={clave(c)}
            className={`fila items-start ${c.vigente ? "" : "opacity-45"}`}
          >
            <div className="min-w-0 flex-1">
              <p className="dato text-[11px] uppercase tracking-wider text-dim">
                {c.cuando}
                {c.vigente ? "" : " · ya no cuenta"}
              </p>
              <p className="mt-0.5 truncate text-sm text-dim">{c.pregunta}</p>
              <p className="font-serif text-base">
                {c.respuesta}
                {c.extra ? <span className="text-dim"> — “{c.extra}”</span> : null}
              </p>
            </div>
            <button
              type="button"
              onClick={() => olvidar(c)}
              disabled={borrando === clave(c)}
              aria-label={`Olvidar: ${c.pregunta} → ${c.respuesta}`}
              className="sello-hueco shrink-0 !min-h-[44px] !px-3 !py-2 !text-[0.65rem]"
            >
              {borrando === clave(c) ? "…" : "Olvidar"}
            </button>
          </li>
        ))}
      </ul>

      {lista.length > 3 && (
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="pulsable mt-3 min-h-[44px] w-full text-left text-sm text-dim underline decoration-dotted underline-offset-4"
        >
          {abierto
            ? "Ver solo las últimas"
            : `Ver las ${lista.length} respuestas`}
        </button>
      )}
    </section>
  );
}
