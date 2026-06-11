"use client";

// Check-in de ánimo: una señal ligera que el motor de recomendación usa para
// elegir (o re-elegir, máx. 1 vez al día) el disco de hoy.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { checkInMood } from "@/app/actions";
import { getDeviceId } from "@/lib/device";

const MOODS = ["Enérgico", "Nostálgico", "Relajado", "Curioso", "Melancólico"];

export function MoodCheckin({
  mood,
  canChange,
}: {
  mood: string | null; // mood ya registrado hoy (si lo hay)
  canChange: boolean; // false cuando ya se gastó la regeneración del día
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [oculto, setOculto] = useState(false);
  const [pendiente, startTransition] = useTransition();

  if (oculto && !mood) return null;

  function elegir(m: string) {
    startTransition(async () => {
      try {
        await checkInMood(getDeviceId(), m);
        setAbierto(false);
        router.refresh();
      } catch {
        // sin conexión o error del servidor: el ritual sigue sin mood
      }
    });
  }

  // Ya hay mood y no está editando: resumen de una línea.
  if (mood && !abierto) {
    return (
      <div className="px-6 pt-6 text-center text-sm text-dim">
        Hoy te sientes <span className="text-album-light">{mood.toLowerCase()}</span>
        {canChange && (
          <>
            {" · "}
            <button
              onClick={() => setAbierto(true)}
              className="underline underline-offset-4"
            >
              cambiar
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="px-6 pt-6 text-center"
    >
      <p className="text-sm text-dim">
        {pendiente ? "Eligiendo tu disco…" : "¿Cómo te sientes hoy?"}
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {MOODS.map((m) => (
          <button
            key={m}
            onClick={() => elegir(m)}
            disabled={pendiente}
            className={`rounded-full border px-4 py-2 text-sm transition-colors disabled:opacity-40 ${
              mood === m
                ? "border-album bg-album/15 text-album-light"
                : "border-white/15 text-foreground/70"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <button
        onClick={() => (mood ? setAbierto(false) : setOculto(true))}
        disabled={pendiente}
        className="mt-3 text-xs text-dim underline underline-offset-4 disabled:opacity-40"
      >
        {mood ? "dejar como está" : "saltar"}
      </button>
    </motion.div>
  );
}
