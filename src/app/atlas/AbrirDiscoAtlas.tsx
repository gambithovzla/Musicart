"use client";

// "Cuéntame su historia": fabrica el dossier de un disco del retrato.
//
// Mismo trato que en el Salón y en los Caminos: si el disco ya está en el
// catálogo, llega al instante; si es nuevo, el pipeline tarda 1-3 minutos y la
// espera se cuenta con honestidad.

import { useState } from "react";
import { useRouter } from "next/navigation";

const MENSAJES: Record<string, string> = {
  presupuesto:
    "Hoy ya se fabricaron todos los discos nuevos que caben en el presupuesto. Vuelve mañana y este te espera.",
  "no-verificado":
    "Encontré cosas sobre este disco que no pude verificar, así que prefiero no contarte nada antes que contarte algo falso.",
  "no-encontrado": "No encuentro este disco en el retrato.",
  error: "Algo se torció por el camino. Inténtalo otra vez en un momento.",
};

export function AbrirDiscoAtlas({
  code,
  orden,
  yaFabricado,
}: {
  code: string;
  orden: number;
  /** albumId si ya tiene dossier: entonces esto es solo un enlace. */
  yaFabricado: string | null;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  if (yaFabricado) {
    return (
      <button
        type="button"
        onClick={() => router.push(`/album/${yaFabricado}`)}
        className="sello-hueco mt-4"
      >
        Leer su historia
      </button>
    );
  }

  async function abrir() {
    setCargando(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/atlas/disco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, orden }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        albumId?: string;
        reason?: string;
      };
      if (data.ok && data.albumId) {
        router.push(`/album/${data.albumId}`);
        return;
      }
      setMensaje(MENSAJES[data.reason ?? "error"] ?? MENSAJES.error);
    } catch {
      setMensaje(MENSAJES.error);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={abrir}
        disabled={cargando}
        aria-busy={cargando}
        className="sello-hueco"
      >
        {cargando ? "Investigando y escribiendo…" : "Cuéntame su historia"}
      </button>
      {cargando && (
        <p className="dato mt-2 text-[11px] leading-relaxed text-tinta-suave">
          Tarda un par de minutos. No cierres esta pantalla.
        </p>
      )}
      {mensaje && (
        <p className="mt-3 text-[13px] leading-relaxed text-tinta-suave">{mensaje}</p>
      )}
    </div>
  );
}
