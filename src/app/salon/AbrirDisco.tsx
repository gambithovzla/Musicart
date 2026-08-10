"use client";

// "Léeme su historia": fabrica el dossier de un disco del canon.
//
// Si el disco ya está en el catálogo llega al instante; si es nuevo, el
// pipeline tarda 1-3 minutos, así que la espera se cuenta con honestidad en vez
// de dejar un botón girando en el vacío.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

type Resultado = { ok: boolean; albumId?: string; reason?: string };

const MENSAJES: Record<string, string> = {
  presupuesto:
    "Hoy ya se fabricaron todos los discos nuevos que caben en el presupuesto. Vuelve mañana y este te espera.",
  "no-verificado":
    "Encontré cosas sobre este disco que no pude verificar, así que prefiero no contarte nada antes que contarte algo falso.",
  "no-encontrado": "No encuentro este disco en el índice.",
  error: "Algo se torció por el camino. Inténtalo otra vez en un momento.",
};

const ESPERAS = [
  "Buscando lo que se sabe de verdad sobre este disco…",
  "Leyendo su historia en las fuentes…",
  "Escribiendo, y luego comprobando cada dato…",
  "Casi: no publico nada que no haya verificado.",
];

export function AbrirDisco({
  canonId,
  yaFabricado,
}: {
  canonId: string;
  /** albumId si el disco ya tiene dossier: entonces esto es solo un enlace. */
  yaFabricado: string | null;
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [paso, setPaso] = useState(0);

  if (yaFabricado) {
    return (
      <button
        type="button"
        onClick={() => router.push(`/album/${yaFabricado}`)}
        className="w-full rounded-full bg-album px-6 py-3.5 text-sm font-medium text-black"
      >
        Leer su historia
      </button>
    );
  }

  async function abrir() {
    setCargando(true);
    setMensaje(null);

    // La cuenta atrás narrada: la espera es larga y hay que acompañarla.
    const reloj = setInterval(
      () => setPaso((p) => Math.min(p + 1, ESPERAS.length - 1)),
      25_000,
    );

    try {
      const res = await fetch("/api/salon/abrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canonId }),
      });
      const data = (await res.json()) as Resultado;

      if (data.ok && data.albumId) {
        router.push(`/album/${data.albumId}`);
        return;
      }
      setMensaje(MENSAJES[data.reason ?? "error"] ?? MENSAJES.error);
    } catch {
      setMensaje(MENSAJES.error);
    } finally {
      clearInterval(reloj);
      setCargando(false);
    }
  }

  if (cargando) {
    return (
      <div className="rounded-2xl border border-album/25 bg-album/5 p-5 text-center">
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
          className="inline-block text-2xl"
        >
          ◎
        </motion.span>
        <p className="mt-3 text-sm text-foreground/85">{ESPERAS[paso]}</p>
        <p className="mt-1.5 text-xs text-dim">
          Puede tardar un par de minutos. No cierres esta pantalla.
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={abrir}
        className="w-full rounded-full bg-album px-6 py-3.5 text-sm font-medium text-black"
      >
        Cuéntame su historia
      </button>
      {mensaje && (
        <p className="mt-3 text-center text-sm leading-relaxed text-dim">
          {mensaje}
        </p>
      )}
    </div>
  );
}
