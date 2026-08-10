"use client";

// Un paso del camino. Tres estados: bloqueado (falta marcar el anterior), abierto
// sin fabricar (botón para abrirlo) y listo (portada + enlace a su historia).
// Abrir un paso puede tardar 1-3 min si el disco es nuevo: lo hace la route
// /api/caminos/paso y aquí acompañamos la espera.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { marcarPasoEscuchado } from "../actions";
import {
  PAPEL_ETIQUETA,
  PAPEL_DESCRIPCION,
  type CaminoStep,
} from "@/lib/caminos-pasos";

export type PasoAlbum = {
  id: string;
  coverUrl: string | null;
};

const FRASES = [
  "Investigando su historia…",
  "Buscando los hechos en fuentes reales…",
  "Escribiendo su dossier…",
  "Verificando que todo lo que dice sea cierto…",
  "Ya casi: afinando los detalles…",
];

export function PasoCard({
  caminoId,
  paso,
  abierto,
  album,
}: {
  caminoId: string;
  paso: CaminoStep;
  abierto: boolean;
  album: PasoAlbum | null;
}) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState<null | "abrir" | "cambiar">(null);
  const [error, setError] = useState<string | null>(null);
  const [ofreceCambio, setOfreceCambio] = useState(false);
  const [frase, setFrase] = useState(0);
  const [pendiente, startTransition] = useTransition();

  const escuchado = Boolean(paso.escuchadoAt);

  useEffect(() => {
    if (trabajando !== "abrir") return;
    const id = setInterval(() => {
      setFrase((f) => (f + 1 < FRASES.length ? f + 1 : f));
    }, 12000);
    return () => clearInterval(id);
  }, [trabajando]);

  async function llamar(accion: "abrir" | "reemplazar") {
    setTrabajando(accion === "abrir" ? "abrir" : "cambiar");
    setError(null);
    setOfreceCambio(false);
    setFrase(0);
    try {
      const res = await fetch("/api/caminos/paso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caminoId, orden: paso.orden, accion }),
      });
      const data = (await res.json()) as { ok?: boolean; reason?: string };
      if (data.ok) {
        router.refresh();
        setTrabajando(null);
        return;
      }
      if (data.reason === "presupuesto") {
        setError(
          "Hoy ya preparamos muchos discos nuevos. Vuelve mañana y sigo por aquí.",
        );
      } else if (data.reason === "no-verificado") {
        setError(
          "Este disco no pasó nuestra verificación, así que no te lo cuento a medias.",
        );
        setOfreceCambio(true);
      } else if (data.reason === "bloqueado") {
        setError("Todavía no toca: marca el paso anterior como escuchado.");
      } else {
        setError("No pude preparar este disco. Inténtalo otra vez.");
      }
    } catch {
      setError("Se cortó la conexión. Inténtalo de nuevo.");
    }
    setTrabajando(null);
  }

  return (
    <li
      className={`relative rounded-2xl border p-4 transition-colors ${
        escuchado
          ? "border-album/25 bg-album/[0.04]"
          : abierto
          ? "border-white/15 bg-white/[0.03]"
          : "border-white/8 bg-white/[0.01]"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
            escuchado ? "bg-album text-black" : "border border-white/20 text-dim"
          }`}
        >
          {escuchado ? "✓" : paso.orden}
        </span>
        <span className="text-[11px] uppercase tracking-[0.2em] text-album-light">
          {PAPEL_ETIQUETA[paso.papel]}
        </span>
      </div>

      <div className={`mt-3 flex gap-3 ${abierto ? "" : "opacity-55"}`}>
        {album?.coverUrl && (
          <Image
            src={album.coverUrl}
            alt={paso.title}
            width={64}
            height={64}
            sizes="64px"
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="font-serif text-lg font-semibold leading-tight">{paso.title}</p>
          <p className="text-sm text-dim">
            {paso.artist}
            {paso.year ? ` · ${paso.year}` : ""}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs italic leading-relaxed text-dim/80">
        {PAPEL_DESCRIPCION[paso.papel]}
      </p>
      {paso.puente && (
        <p className="mt-2 text-sm leading-relaxed text-foreground/85">{paso.puente}</p>
      )}

      {/* Estado de trabajo: abrir un disco nuevo tarda, así que acompañamos. */}
      {trabajando === "abrir" && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-album/20 bg-album/5 px-3 py-3">
          <motion.span
            aria-hidden
            className="h-4 w-4 shrink-0 rounded-full border-2 border-album/30 border-t-album"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          />
          <AnimatePresence mode="wait">
            <motion.p
              key={frase}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35 }}
              className="text-xs text-dim"
            >
              {FRASES[frase]}
            </motion.p>
          </AnimatePresence>
        </div>
      )}
      {trabajando === "cambiar" && (
        <p className="mt-4 text-xs text-dim">Buscándote otro disco para este paso…</p>
      )}

      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}

      {!trabajando && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!abierto && (
            <p className="text-xs text-dim/70">
              Se abre cuando marques el paso anterior como escuchado.
            </p>
          )}

          {abierto && album && (
            <Link
              href={`/album/${album.id}`}
              className="rounded-xl bg-album px-4 py-2 text-sm font-medium text-black"
            >
              {escuchado ? "Volver a su historia" : "Leer su historia"}
            </Link>
          )}

          {abierto && !album && (
            <button
              type="button"
              onClick={() => llamar("abrir")}
              className="rounded-xl bg-album px-4 py-2 text-sm font-medium text-black"
            >
              Abrir este disco
            </button>
          )}

          {abierto && !escuchado && album && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() =>
                startTransition(async () => {
                  await marcarPasoEscuchado(caminoId, paso.orden);
                  router.refresh();
                })
              }
              className="rounded-xl border border-white/20 px-4 py-2 text-sm text-dim transition-colors hover:border-album/50 hover:text-foreground disabled:opacity-50"
            >
              Ya lo escuché
            </button>
          )}

          {abierto && !escuchado && (
            <button
              type="button"
              onClick={() => llamar("reemplazar")}
              className="text-xs text-dim/70 underline underline-offset-4 transition-colors hover:text-dim"
            >
              {ofreceCambio ? "Cámbiamelo por otro" : "Ya lo conozco, dame otro"}
            </button>
          )}
        </div>
      )}
    </li>
  );
}
