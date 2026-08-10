"use client";

// Controles de curador sobre un disco del canon (Fase 9.7, solo admin).
// Viven en la propia ficha del disco y no escondidos en /revision, por la misma
// razón que los controles de la Vitrina en 7.6: se curan las cosas donde se
// están mirando.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  fijarPuntajeCanon,
  soltarPuntajeCanon,
  quitarDelCanon,
} from "./admin-actions";

export function CuradorCanon({
  canonId,
  scoreActual,
  bloqueado,
  titulo,
}: {
  canonId: string;
  scoreActual: number;
  bloqueado: boolean;
  titulo: string;
}) {
  const router = useRouter();
  const [score, setScore] = useState(scoreActual);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function correr(accion: () => Promise<{ ok: boolean; error?: string }>, exito: string) {
    setMensaje(null);
    startTransition(async () => {
      const r = await accion();
      setMensaje(r.ok ? exito : (r.error ?? "No se pudo."));
      if (r.ok) router.refresh();
    });
  }

  return (
    <details className="mt-10 rounded-2xl border border-album/20 bg-album/5 p-4">
      <summary className="cursor-pointer list-none text-sm font-medium text-album-light">
        🏛 Curar este disco en el canon
      </summary>

      <p className="mt-2 text-xs leading-relaxed text-dim">
        {bloqueado ? (
          <>
            Su puntaje está <strong className="text-foreground">fijado a mano</strong>: la
            ingesta no lo toca. Si lo sueltas, vuelve a mandar la fórmula.
          </>
        ) : (
          <>
            Su puntaje lo calcula la fórmula y se recalcula en cada corrida del
            índice. Fíjalo si quieres que tu criterio mande sobre este disco.
          </>
        )}
      </p>

      <div className="mt-4">
        <label htmlFor="curador-score" className="text-xs text-dim">
          Puntaje en el canon: <strong className="text-foreground">{score}</strong>
        </label>
        <input
          id="curador-score"
          type="range"
          min={55}
          max={100}
          step={1}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--album,#c9a227)]"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            correr(
              () => fijarPuntajeCanon(canonId, score),
              `Fijado en ${score}. Ya no lo toca la ingesta.`,
            )
          }
          className="rounded-full bg-album px-4 py-2 text-xs font-medium text-black disabled:opacity-60"
        >
          Fijar en {score}
        </button>

        {bloqueado && (
          <button
            type="button"
            disabled={pendiente}
            onClick={() =>
              correr(
                () => soltarPuntajeCanon(canonId),
                "Soltado: vuelve a puntuarlo la fórmula.",
              )
            }
            className="rounded-full border border-white/20 px-4 py-2 text-xs disabled:opacity-60"
          >
            Soltar el puntaje
          </button>
        )}

        <button
          type="button"
          disabled={pendiente}
          onClick={() => {
            if (!confirm(`¿Sacar "${titulo}" del índice del canon?`)) return;
            correr(async () => {
              const r = await quitarDelCanon(canonId);
              if (r.ok) router.push("/salon");
              return r;
            }, "Fuera del canon.");
          }}
          className="rounded-full border border-red-400/30 px-4 py-2 text-xs text-red-300/90 disabled:opacity-60"
        >
          Quitar del canon
        </button>
      </div>

      {mensaje && <p className="mt-3 text-xs text-album-light">{mensaje}</p>}
    </details>
  );
}
