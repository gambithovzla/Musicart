"use client";

// Botón solo-admin (Fase 6): rehace el disco de hoy a la medida. Borra el pick
// guardado y fabrica uno fresco (1-3 min). Pensado para el dueño: "genero el
// disco que me dé la gana, cuando me dé la gana". No aparece para usuarios.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RehacerDiscoAdmin() {
  const router = useRouter();
  const [estado, setEstado] = useState<"idle" | "trabajando" | "error">("idle");

  async function rehacer() {
    if (estado === "trabajando") return;
    setEstado("trabajando");
    try {
      const res = await fetch("/api/pick-hoy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rehacer: true }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (!data.ok) {
        setEstado("error");
        return;
      }
      router.refresh();
      setEstado("idle");
    } catch {
      setEstado("error");
    }
  }

  return (
    <div className="px-6 pt-4 text-center">
      <button
        onClick={rehacer}
        disabled={estado === "trabajando"}
        className="rounded-full border border-album/40 px-4 py-2 text-xs text-album-light transition-colors hover:bg-album/10 disabled:opacity-50"
      >
        {estado === "trabajando"
          ? "Fabricando otro disco a tu medida… (1-3 min)"
          : "✦ Admin · Rehacer mi disco de hoy"}
      </button>
      {estado === "error" && (
        <p className="mt-2 text-xs text-red-300/90">
          No se pudo rehacer ahora. Intenta de nuevo en un momento.
        </p>
      )}
    </div>
  );
}
