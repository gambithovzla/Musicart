"use client";

// Sección plegable del dossier: cada bloque se abre y cierra con un toque, para
// que el disco entero quepa en un vistazo y no haya que hacer tanto scroll.
//
// Compuesta en la imprenta (nov 2026). Antes era una tarjeta redondeada con
// degradado y una pastilla numerada: la plantilla de siempre. Ahora es una
// entrada de SUMARIO: folio en monoespaciada, titular en display y un filete
// debajo; la fila entera es el objetivo táctil (60px, regla VIII) y el signo
// + / − dice si está abierta. Al abrirse, el texto se IMPRIME de arriba abajo.

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

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
  const reducir = useReducedMotion();

  return (
    <section className={accent ? "border-y-2 border-acento" : "border-b border-regla"}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="fila !border-b-0 gap-4"
      >
        <span
          className={`dato w-7 shrink-0 text-[12px] transition-colors ${
            open || accent ? "text-acento" : "text-tinta-suave"
          }`}
        >
          № {n}
        </span>
        <span className="font-serif flex-1 text-[1.2rem] font-medium leading-tight">{title}</span>
        <span
          aria-hidden
          className={`dato w-6 shrink-0 text-center text-xl leading-none transition-transform duration-300 ${
            open ? "rotate-180 text-acento" : "text-tinta-suave"
          }`}
        >
          {open ? "−" : "+"}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="contenido"
            initial={reducir ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reducir ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reducir ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <motion.div
              initial={reducir ? false : { clipPath: "inset(0 0 100% 0)" }}
              animate={{ clipPath: "inset(0 0 0% 0)" }}
              transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="pb-7 pt-1"
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
