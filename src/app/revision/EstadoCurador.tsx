"use client";

// «¿El curador está vivo?» — el diagnóstico de una pulsación.
//
// El dueño no tiene terminal ni mira los logs de Vercel: anda con el teléfono.
// Cuando la IA se cae, la app NO se cae (es su regla), así que el síntoma que
// llega es engañoso: discos que no cumplen lo que pediste, repetidos y servidos
// al instante. Aquí se ve de un vistazo si hay clave, con qué modelos habla la
// app y qué contestan de verdad ahora mismo.

import { useState } from "react";
import { probarCurador } from "./actions";

type Prueba = {
  nombre: string;
  modelo: string;
  ok: boolean;
  ms: number;
  detalle: string;
};

type Resultado = {
  hayClave: boolean;
  proveedor: string;
  pruebas: Prueba[];
};

export function EstadoCurador({
  usados,
  tope,
  quedanExtra,
}: {
  usados: number;
  tope: number;
  quedanExtra: number;
}) {
  const [estado, setEstado] = useState<"idle" | "probando">("idle");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function probar() {
    setEstado("probando");
    setError(null);
    try {
      setResultado(await probarCurador());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEstado("idle");
    }
  }

  const todoBien = resultado?.pruebas.every((p) => p.ok) ?? false;

  return (
    <section className="mt-6">
      <div className="cabecera-seccion">
        <span className="rotulo">¿El curador está vivo?</span>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-dim">
        Si la IA no responde, la app no se cae: te sirve un disco del catálogo en
        tres segundos. Se parece a «dejó de leer lo que pido». Aquí sales de
        dudas: se hace una llamada de verdad a cada modelo.
      </p>

      <button
        type="button"
        onClick={probar}
        disabled={estado === "probando"}
        className="sello mt-4 w-full disabled:opacity-50"
      >
        {estado === "probando" ? "Preguntando a los modelos…" : "Probar el curador ahora"}
      </button>

      {error && <p className="mt-3 text-xs text-red-300/90">{error}</p>}

      {resultado && (
        <div className="mt-4 border-l-2 border-album pl-3">
          <p className="text-sm">
            {todoBien ? (
              <span className="text-album-light">
                El curador responde. Si aun así te sirvió un disco que no pediste,
                mira el cupo de abajo o abre la bitácora del disco del día.
              </span>
            ) : (
              <span className="text-red-300">
                El curador NO está respondiendo. Mientras siga así, todos los
                discos salen del catálogo ya publicado y los pedidos no se pueden
                cumplir.
              </span>
            )}
          </p>
          <p className="dato mt-2 text-[11px] uppercase tracking-[0.08em] text-dim">
            Proveedor: {resultado.proveedor}
          </p>
          <ul className="mt-2 space-y-2">
            {resultado.pruebas.map((p) => (
              <li key={p.nombre} className="text-xs leading-relaxed">
                <span className={p.ok ? "text-album-light" : "text-red-300"}>
                  {p.ok ? "✓" : "✗"} {p.nombre}
                </span>{" "}
                <span className="dato text-dim">
                  · {p.modelo} · {p.ms} ms
                </span>
                <span className="block text-dim/80">{p.detalle}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-dim">
        Cupo de discos nuevos de hoy: <span className="dato">{usados}/{tope}</span>.
        {quedanExtra <= 0 ? (
          <span className="text-album-light">
            {" "}
            Se acabó la parte que pueden gastar el Salón, los Caminos y los saltos:
            el resto queda reservado para el disco del día.
          </span>
        ) : (
          <span> Quedan {quedanExtra} para el Salón, los Caminos y los saltos.</span>
        )}
      </p>
    </section>
  );
}
