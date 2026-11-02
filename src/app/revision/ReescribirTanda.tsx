"use client";

// Tanda de reescritura desde el panel: como "Levantar el Salón", trabaja un
// tramo con presupuesto de tiempo y dice cuántas faltan para darle otra vez.

import { useState } from "react";
import { useRouter } from "next/navigation";

type Hecha = { ok: boolean; titulo: string; motivo?: string };

export function ReescribirTanda({ pendientes, total }: { pendientes: number; total: number }) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [quedan, setQuedan] = useState(pendientes);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [hechas, setHechas] = useState<Hecha[]>([]);

  async function tanda() {
    if (trabajando) return;
    setTrabajando(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/historias/reescribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tanda: 3 }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        mensaje?: string;
        pendientes?: number;
        hechas?: Hecha[];
      };
      setMensaje(data.mensaje ?? null);
      if (typeof data.pendientes === "number") setQuedan(data.pendientes);
      if (data.hechas) setHechas((prev) => [...data.hechas!, ...prev].slice(0, 15));
      router.refresh();
    } catch {
      setMensaje("Se cortó la conexión. Recarga la página: lo que terminó ya está guardado.");
    } finally {
      setTrabajando(false);
    }
  }

  const listas = Math.max(0, total - quedan);

  return (
    <div className="mt-5">
      <div className="filete flex items-baseline justify-between gap-4 border-b border-regla py-3">
        <span className="rotulo">Con el redactor nuevo</span>
        <span className="dato text-sm">
          <span className="text-acento">{listas}</span>
          <span className="text-tinta-suave"> / {total}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={tanda}
        disabled={trabajando || quedan === 0}
        aria-busy={trabajando}
        className="sello mt-4 w-full"
      >
        {trabajando
          ? "Reescribiendo 3… (hasta 4 min)"
          : quedan === 0
            ? "Todas reescritas"
            : `Reescribir 3 de ${quedan}`}
      </button>
      {mensaje && (
        <p className="mt-3 text-sm text-tinta" role="status">
          {mensaje}
        </p>
      )}
      {hechas.length > 0 && (
        <ol className="mt-3 border-t border-regla">
          {hechas.map((h, i) => (
            <li key={`${h.titulo}-${i}`} className="border-b border-regla py-2 text-[13px] leading-snug">
              <span className={h.ok ? "text-acento" : "text-tinta-suave"}>{h.ok ? "Lista · " : "Sin cambio · "}</span>
              {h.titulo}
              {!h.ok && h.motivo && <span className="block text-tinta-suave">{h.motivo}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
