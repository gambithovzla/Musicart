"use client";

// La espera mientras se escribe el retrato de un país (Fase 11).
//
// Hermana de `CreandoDiscoHoy`: la fabricación tarda, y una pantalla en blanco
// con una ruedecita da a entender que la app se colgó. Así que la espera se
// CUENTA, y se cuenta lo que de verdad está pasando — incluida la parte de la
// que Musicart está orgullosa: que a cada artista se le comprueba el origen.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const ESPERAS = [
  "Buscando los discos con los que se cuenta este país…",
  "Comprobando que cada artista sea de verdad de ahí…",
  "Cruzando MusicBrainz, Wikidata y la Wikipedia…",
  "Escribiendo qué cuenta cada disco. Ya casi.",
];

export function CreandoRetrato({ code, pais }: { code: string; pais: string }) {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const lanzado = useRef(false);

  useEffect(() => {
    // En desarrollo React monta dos veces: sin esto se pedirían dos retratos
    // (y se pagarían dos llamadas al curador).
    if (lanzado.current) return;
    lanzado.current = true;

    const reloj = setInterval(
      () => setPaso((p) => Math.min(p + 1, ESPERAS.length - 1)),
      20_000,
    );

    (async () => {
      try {
        const res = await fetch("/api/atlas/retrato", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = (await res.json()) as { ok: boolean };
        if (!data.ok) {
          setError(
            "No pude escribir este retrato ahora mismo. Vuelve a intentarlo en un rato.",
          );
          return;
        }
        router.refresh();
      } catch {
        setError("Se cortó por el camino. Vuelve a intentarlo en un rato.");
      } finally {
        clearInterval(reloj);
      }
    })();

    return () => clearInterval(reloj);
  }, [code, router]);

  if (error) {
    return (
      <p className="mt-8 text-[13px] leading-relaxed text-tinta-suave">{error}</p>
    );
  }

  return (
    <div className="recuadro mt-8 p-5">
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
        className="circulo inline-block text-2xl text-acento"
      >
        ◎
      </motion.span>
      <p className="font-serif mt-3 text-[17px] leading-tight">
        Escribiendo el retrato de {pais}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed">{ESPERAS[paso]}</p>
      <p className="dato mt-3 text-[11px] leading-relaxed text-tinta-suave">
        Tarda un par de minutos. Se escribe una sola vez: el siguiente que entre
        lo verá al instante.
      </p>
    </div>
  );
}
