"use client";

// Botón para cualquier oyente (Fase 7): "¿No encontraste este disco?" → fabrica
// OTRO disco fresco al instante. Pensado para cuando el disco del día no se halla
// en streaming o no convence. Tiene un tope diario (lo controla /api/pick-hoy)
// para cuidar el costo de IA; al alcanzarlo, avisa con cariño y no rehace más.

import { useState } from "react";
import { useRouter } from "next/navigation";

type Estado = "idle" | "confirmar" | "trabajando" | "limite" | "error";

export function DameOtroDisco() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("idle");

  async function pedirOtro() {
    setEstado("trabajando");
    try {
      const res = await fetch("/api/pick-hoy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otro: true }),
      });
      const data = (await res.json()) as { ok?: boolean; reason?: string };
      if (!data.ok) {
        setEstado(data.reason === "limite" ? "limite" : "error");
        return;
      }
      router.refresh();
      setEstado("idle");
    } catch {
      setEstado("error");
    }
  }

  if (estado === "trabajando") {
    return (
      <p className="mt-5 text-center text-xs text-dim">
        Buscándote otro disco… (puede tardar 1-3 min)
      </p>
    );
  }

  if (estado === "limite") {
    return (
      <p className="mx-auto mt-5 max-w-xs text-center text-xs text-dim">
        Por hoy ya probamos varios discos. Mañana te traigo uno nuevo a tu medida.
      </p>
    );
  }

  if (estado === "confirmar") {
    return (
      <div className="mt-5 text-center">
        <p className="mx-auto mb-3 max-w-xs text-xs text-dim">
          ¿No encontraste este disco o no te convence? Te fabrico otro distinto
          ahora mismo.
        </p>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={pedirOtro}
            className="rounded-full bg-album px-4 py-2 text-xs font-semibold text-black transition-transform active:scale-95"
          >
            Sí, dame otro
          </button>
          <button
            type="button"
            onClick={() => setEstado("idle")}
            className="rounded-full border border-white/15 px-4 py-2 text-xs text-dim transition-colors hover:bg-white/5"
          >
            Mejor no
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 text-center">
      <button
        type="button"
        onClick={() => setEstado("confirmar")}
        className="text-xs text-dim underline underline-offset-4 transition-colors hover:text-album-light"
      >
        ¿No encontraste este disco? Prueba con otro
      </button>
      {estado === "error" && (
        <p className="mt-2 text-xs text-red-300/90">
          No se pudo ahora. Intenta de nuevo en un momento.
        </p>
      )}
    </div>
  );
}
