// Dificultad de escucha (1-5 estrellas), clicleable para que se entienda bien:
// no mide calidad, sino cuánta atención pide el disco. Usa <details> nativo.

import { Stars } from "./Stars";

const PALABRA = ["", "entra fácil", "accesible", "pide atención", "exigente", "oído atento"];

export function DificultadEscucha({ value }: { value: number }) {
  const v = Math.max(1, Math.min(5, Math.round(value)));
  return (
    <details className="group inline-block text-left align-middle">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
        <span className="text-dim">Dificultad</span>
        <Stars value={v} />
        <span className="text-dim">· {PALABRA[v]}</span>
        <span className="ml-0.5 text-album-light/70 underline decoration-dotted underline-offset-2 group-open:hidden">
          ¿qué es?
        </span>
      </summary>
      <div className="mt-2 max-w-xs rounded-xl border border-album/20 bg-album/5 px-4 py-3 text-xs leading-relaxed text-foreground/80">
        <p>
          La <span className="text-album-light">dificultad</span> no mide si el
          disco es bueno o malo, sino cuánta atención te pide: 1★ entra fácil de
          fondo; 5★ pide escucha dedicada, con audífonos y sin distracciones.
        </p>
      </div>
    </details>
  );
}
