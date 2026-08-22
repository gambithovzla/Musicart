"use client";

// Rehacer el retrato de un país. Solo el curador: un retrato ya escrito es de
// todos, y rehacerlo gasta IA en algo que ya existía.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RehacerRetrato({ code }: { code: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rehacer() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/atlas/retrato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, rehacer: true }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) setError("No se pudo rehacer ahora mismo.");
      else router.refresh();
    } catch {
      setError("No se pudo rehacer ahora mismo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={rehacer}
        disabled={cargando}
        aria-busy={cargando}
        className="sello-hueco"
      >
        {cargando ? "Reescribiendo…" : "Rehacer este retrato"}
      </button>
      {error && (
        <p className="mt-2 text-[12px] leading-relaxed text-tinta-suave">{error}</p>
      )}
    </div>
  );
}
