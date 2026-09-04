"use client";

// Abandonar un camino. Con confirmación en dos toques: borrar por accidente lo
// que llevas andado sería feo.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarCamino } from "../actions";

export function BorrarCamino({ caminoId }: { caminoId: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, startTransition] = useTransition();

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-xs text-dim/60 underline underline-offset-4 transition-colors hover:text-dim"
      >
        Abandonar este camino
      </button>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3">
      <span className="text-xs text-dim">¿Seguro? Se pierde lo andado.</span>
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          startTransition(async () => {
            await eliminarCamino(caminoId);
            router.push("/caminos");
          })
        }
        className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs text-red-300 disabled:opacity-50"
      >
        Sí, abandonar
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="text-xs text-dim underline underline-offset-4"
      >
        No
      </button>
    </div>
  );
}
