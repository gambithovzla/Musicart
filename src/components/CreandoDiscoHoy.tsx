"use client";

// Pantalla de carga del disco fresco del día (Fase 6). Al montarse, dispara la
// fabricación (POST /api/pick-hoy, 1-3 min) y, cuando termina, refresca la home
// para mostrar el disco recién hecho. Si falla, igual refresca: la home cae a la
// rotación global. Pase lo que pase, el ritual nunca se queda colgado.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const FRASES = [
  "Buscando un disco que sea tuyo…",
  "Leyendo tu perfil y tu diario…",
  "Investigando su historia…",
  "Verificando que todo sea cierto…",
  "Casi listo: afinando los detalles…",
];

export function CreandoDiscoHoy() {
  const router = useRouter();
  const yaDisparado = useRef(false);
  const [frase, setFrase] = useState(0);

  useEffect(() => {
    // Frases que se turnan para que la espera se sienta viva.
    const id = setInterval(() => {
      setFrase((f) => (f + 1 < FRASES.length ? f + 1 : f));
    }, 9000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (yaDisparado.current) return;
    yaDisparado.current = true;

    let activo = true;
    (async () => {
      try {
        await fetch("/api/pick-hoy", { method: "POST" });
      } catch {
        // sin conexión o timeout: refrescamos igual (cae a rotación global).
      }
      if (activo) router.refresh();
    })();

    return () => {
      activo = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-[80dvh] flex-col items-center justify-center gap-8 px-8 text-center">
      <motion.div
        aria-hidden
        className="h-16 w-16 rounded-full border-2 border-album/30 border-t-album"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
      />
      <div>
        <h1 className="font-serif text-2xl font-semibold">
          Estamos creando tu disco de hoy
        </h1>
        <div className="mt-3 h-6">
          <AnimatePresence mode="wait">
            <motion.p
              key={frase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4 }}
              className="text-sm text-dim"
            >
              {FRASES[frase]}
            </motion.p>
          </AnimatePresence>
        </div>
        <p className="mt-6 text-xs text-dim/70">
          La primera vez del día tarda un momento porque lo hacemos a tu medida.
        </p>
      </div>
    </main>
  );
}
