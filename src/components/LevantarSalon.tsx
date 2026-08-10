"use client";

// El botón que levanta el Salón de la Fama (9.10).
//
// Antes esto era una nota que decía "corre `npm run canon`". Para el dueño, que
// suele estar en el teléfono, eso equivalía a "no se puede". Ahora es un botón:
// cada toque construye un tramo del canon y te cuenta qué entró. Si queda
// trabajo lo dice y lo vuelves a tocar; si no lo tocas nunca más, el worker de
// Railway lo termina de noche igual.
//
// Vive en /components y no en /revision porque lo usan DOS pantallas: el panel
// del curador y la propia pestaña del Salón cuando está vacía. Ahí antes había
// un enlace a /revision, y ese enlace era el bug: si por lo que sea la sesión no
// se leía igual en la otra pantalla, el curador acababa en el inicio de sesión y
// de ahí en su perfil — pulsabas "Levantarlo ahora" y terminabas en /perfil sin
// haber levantado nada. La acción no debe viajar a otra ruta para pedir permiso:
// /api/salon/construir ya comprueba que eres el curador por su cuenta, así que
// el botón hace aquí mismo lo que promete.

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

export function LevantarSalon({
  total,
  enmarcado = true,
}: {
  total: number;
  /** En el Salón vacío la sección ya va enmarcada por sus reglas: ahí no. */
  enmarcado?: boolean;
}) {
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
    <div
      className={
        enmarcado
          ? "recuadro p-4 text-left"
          : "mx-auto max-w-[19rem] text-center"
      }
    >
      {enmarcado && (
        <>
          <p className="rotulo">
            {total === 0 ? "Levantar el Salón" : "Seguir llenando el Salón"}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-tinta-suave">
            {total === 0
              ? "El índice del canon está vacío: por eso la pestaña del Salón se ve sin discos. Dale aquí y empieza a llenarse (tarda unos minutos; puede hacer falta más de un toque)."
              : `El canon tiene ${total} discos. Cada toque trae otro tramo y busca carátulas que falten.`}
          </p>
        </>
      )}

      <button
        type="button"
        onClick={avanzar}
        disabled={cargando}
        aria-busy={cargando}
        className={`sello ${enmarcado ? "mt-3" : "mt-6"}`}
      >
        {cargando
          ? "Construyendo…"
          : total === 0
            ? "Levantarlo ahora"
            : "Traer más discos"}
      </button>

      {cargando && (
        <p className="mt-3 text-[12px] leading-relaxed text-tinta-suave">
          No cierres esta pantalla. Está hablando con Wikidata y escribiendo el
          índice; puede tardar varios minutos. Al terminar te digo cuántos discos
          entraron.
        </p>
      )}

      {avance && !cargando && (
        <div className="regla mt-4 pt-3">
          <p className="text-[12px] leading-relaxed">
            {avance.mensaje ?? "Listo."}
            {avance.ok && avance.quedaTrabajo && (
              <>
                {" "}
                <span className="text-album">Vuelve a darle para seguir.</span>
              </>
            )}
          </p>
          {avance.detalle && (
            <p className="dato mt-2 text-[11px] leading-relaxed text-tinta-suave">
              {avance.detalle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
