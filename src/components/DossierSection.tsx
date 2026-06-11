"use client";

// Sección plegable del dossier: cada bloque se abre y cierra con un toque, para
// que el disco entero quepa en un vistazo y no haya que hacer tanto scroll. El
// número se enciende con el color del disco cuando la sección está abierta.

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function DossierSection({
  n,
  title,
  children,
  defaultOpen = false,
  accent = false,
}: {
  n: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  accent?: boolean; // resalta la sección de "escuchar" (la acción del ritual)
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={`overflow-hidden rounded-2xl border shadow-[0_10px_30px_-22px_rgba(0,0,0,0.9)] transition-colors duration-300 ${
        open ? "border-album/30" : "border-white/[0.08]"
      } ${
        accent
          ? "bg-album/[0.06]"
          : "bg-gradient-to-b from-surface to-surface/30"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors active:bg-white/5"
      >
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums transition-colors duration-300 ${
            open ? "bg-album text-black" : "bg-album/10 text-album-light"
          }`}
        >
          {n}
        </span>
        <span className="font-serif flex-1 text-lg font-medium leading-tight">
          {title}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="shrink-0 text-album-light/60"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="contenido"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-6 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
