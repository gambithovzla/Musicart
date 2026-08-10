"use client";

// El botón que levanta el Salón de la Fama (9.10).
//
// Antes esto era una nota que decía "corre `npm run canon`". Para el dueño, que
// suele estar en el teléfono, eso equivalía a "no se puede". Ahora es un botón:
// cada toque construye un tramo del canon y te cuenta qué entró. Si queda
// trabajo lo dice y lo vuelves a tocar; si no lo tocas nunca más, el worker de
// Railway lo termina de noche igual.

import { useState } from "react";
import { useRouter } from "next/navigation";

type Avance = {
  ok?: boolean;
  paso?: "indice" | "portadas" | "al-dia";
  mensaje?: string;
  quedaTrabajo?: boolean;
  total?: number;
  sinPortada?: number;
  detalle?: string;
};

export function LevantarSalon({ total }: { total: number }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [avance, setAvance] = useState<Avance | null>(null);

  async function avanzar() {
    if (cargando) return;
    setCargando(true);
    setAvance(null);
    try {
      const res = await fetch("/api/salon/construir", { method: "POST" });
      const data = (await res.json()) as Avance;
      setAvance(data);
      if (data.ok) router.refresh();
    } catch {
      setAvance({
        ok: false,
        mensaje: "Se cortó la conexión antes de terminar. Vuelve a intentarlo.",
      });
    }
    setCargando(false);
  }

  return (
    <div className="rounded-2xl border border-album/20 bg-album/5 p-4">
      <p className="text-sm font-medium text-album-light">
        {total === 0 ? "Levantar el Salón" : "Seguir llenando el Salón"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-dim">
        {total === 0
          ? "El índice del canon está vacío: por eso la pestaña del Salón se ve sin discos. Dale aquí y empieza a llenarse (tarda unos minutos; puede hacer falta más de un toque)."
          : `El canon tiene ${total} discos. Cada toque trae otro tramo y busca carátulas que falten.`}
      </p>

      <button
        type="button"
        onClick={avanzar}
        disabled={cargando}
        className="mt-3 rounded-xl bg-album px-4 py-2 text-sm font-medium text-black transition-opacity disabled:opacity-50"
      >
        {cargando
          ? "Construyendo… (puede tardar varios minutos)"
          : total === 0
          ? "Levantar el Salón"
          : "Traer más discos"}
      </button>

      {cargando && (
        <p className="mt-2 text-xs leading-relaxed text-dim">
          No cierres esta pantalla. Está hablando con Wikidata y escribiendo el
          índice; al terminar te digo cuántos discos entraron.
        </p>
      )}

      {avance && !cargando && (
        <div className="mt-3 rounded-xl bg-black/30 p-3">
          <p className="text-xs leading-relaxed">
            {avance.mensaje ?? "Listo."}
            {avance.ok && avance.quedaTrabajo && (
              <>
                {" "}
                <span className="text-album-light">
                  Vuelve a darle para seguir.
                </span>
              </>
            )}
          </p>
          {avance.detalle && (
            <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-dim">
              {avance.detalle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
