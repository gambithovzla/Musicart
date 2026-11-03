"use client";

// LA PORTADA DEL DOSSIER — la carátula como protagonista.
//
// Antes: una miniatura de 192px, centrada, con esquinas redondeadas y un halo de
// neón detrás (tres gestos de la plantilla que la imprenta prohíbe). Ahora es
// una LÁMINA a todo el ancho, con su trama de fotograbado y un baño de la tinta
// del disco, que se aleja un poco al hacer scroll (la página se mueve contigo,
// sin efectos de feria). Debajo, el titular a la izquierda y las dos puertas:
// ver la historia (pantalla completa) y oír 30 segundos.

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { HistoriaDisco, type HistoriaMeta } from "./HistoriaDisco";
import { SelloFragmento } from "./Fragmentos";
import type { Escena } from "@/lib/historia-escenas";

export function PortadaDossier({
  meta,
  escenas,
  ficha,
  generos,
  compartir,
  historiaDisponible,
}: {
  meta: HistoriaMeta;
  escenas: Escena[];
  ficha: ReactNode; // la tira de datos (duración, dificultad, impacto)
  generos?: ReactNode;
  compartir?: ReactNode;
  historiaDisponible: boolean; // sin acceso (paywall) no se abre la historia
}) {
  const reducir = useReducedMotion();
  const [abierta, setAbierta] = useState(false);
  const [portadaRota, setPortadaRota] = useState(false);
  const lamina = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: lamina, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reducir ? ["0%", "0%"] : ["0%", "18%"]);
  const escala = useTransform(scrollYProgress, [0, 1], reducir ? [1, 1] : [1, 1.08]);
  const tinta = useTransform(scrollYProgress, [0, 1], [0, 0.6]);

  // /album/[id]?historia=1 abre directamente la historia (desde la portada del
  // día o un enlace compartido). Se lee aquí y no con useSearchParams para no
  // obligar a toda la página a ir dentro de un Suspense.
  useEffect(() => {
    if (!historiaDisponible) return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("historia") === "1") setAbierta(true);
  }, [historiaDisponible]);

  const laminas = escenas.length;

  return (
    <>
      <header>
        {/* ── La lámina ── */}
        <div ref={lamina} className="relative aspect-square w-full overflow-hidden border-b border-tinta bg-papel-alto">
          {meta.coverUrl && !portadaRota ? (
            <motion.div style={{ y, scale: escala }} className="trama trama-tinta absolute inset-0">
              <Image
                src={meta.coverUrl}
                alt={`Portada de ${meta.title}`}
                fill
                sizes="(max-width: 512px) 100vw, 512px"
                priority
                className="object-cover"
                // Si la dirección guardada no existe (pasa con algunas del Cover
                // Art Archive), se enseña el plato de tinta en vez de un hueco.
                onError={() => setPortadaRota(true)}
              />
            </motion.div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-serif text-7xl text-acento">♪</span>
            </div>
          )}
          {/* Al bajar, la lámina se entinta con el color del disco. */}
          <motion.div
            aria-hidden
            style={{ opacity: tinta, background: "var(--album-dark)" }}
            className="pointer-events-none absolute inset-0 z-[2]"
          />
          {/* El pie va siempre en blanco roto: está impreso sobre el baño oscuro
              de la portada, en las dos ediciones. */}
          <span className="dato absolute bottom-3 left-5 z-[3] text-[11px] uppercase tracking-[0.12em] text-[#f0e7d5]">
            Lám. I · {meta.artist}
          </span>
          <span className="dato absolute bottom-3 right-5 z-[3] text-[11px] text-[#f0e7d5]">{meta.year}</span>
        </div>

        {/* ── El titular ── */}
        <motion.div
          initial={reducir ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="px-5 pt-6"
        >
          <p className="rotulo">El dossier</p>
          <h1 className="font-serif mt-2 text-[2.6rem] font-semibold leading-[0.94]">{meta.title}</h1>
          <p className="dato mt-2.5 text-[11px] uppercase tracking-[0.18em] text-tinta-suave">
            {meta.artist} · {meta.year}
          </p>
          {generos && <div className="mt-3">{generos}</div>}
          <div className="filete mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-regla py-2.5 text-[12px] text-tinta-suave">
            {ficha}
          </div>

          {/* ── Las dos puertas ── */}
          <div className="mt-6 flex flex-col gap-3">
            {historiaDisponible && laminas > 2 && (
              <button type="button" onClick={() => setAbierta(true)} className="sello sello-reparte w-full">
                <span>Ver la historia</span>
                <span className="dato sello-libre opacity-80">{laminas} láminas ›</span>
              </button>
            )}
            <SelloFragmento preferida={meta.title} />
          </div>
          {compartir && <div className="mt-4">{compartir}</div>}
        </motion.div>
      </header>

      {historiaDisponible && (
        <HistoriaDisco
          escenas={escenas}
          meta={meta}
          abierta={abierta}
          onCerrar={() => {
            setAbierta(false);
            // Que "atrás" no vuelva a abrirla: quitamos el ?historia=1.
            const url = new URL(window.location.href);
            if (url.searchParams.has("historia")) {
              url.searchParams.delete("historia");
              window.history.replaceState(null, "", url.toString());
            }
          }}
        />
      )}
    </>
  );
}
