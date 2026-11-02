"use client";

// Botón del curador: reescribir la historia de ESTE disco con el redactor nuevo.
// Tarda uno o dos minutos (tres pasos de IA + verificación); mientras, se queda
// entintado y lo dice. Si la nueva no pasa la verificación, avisa y no toca nada.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReescribirHistoria({ albumId, yaNueva }: { albumId: string; yaNueva: boolean }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"quieto" | "trabajando" | "hecho" | "error">("quieto");
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function reescribir() {
    if (estado === "trabajando") return;
    setEstado("trabajando");
    setMensaje(null);
    try {
      const res = await fetch("/api/historias/reescribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumId }),
      });
      const data = (await res.json()) as { ok?: boolean; mensaje?: string; avisos?: string[] };
      setEstado(data.ok ? "hecho" : "error");
      setMensaje([data.mensaje, ...(data.avisos ?? [])].filter(Boolean).join(" "));
      if (data.ok) router.refresh();
    } catch {
      setEstado("error");
      setMensaje("Se cortó la conexión. Si tardó mucho, recarga: puede que sí se haya guardado.");
    }
  }

  return (
    <div>
      <p className="rotulo mb-2">Historia</p>
      <p className="mb-3 text-[13px] leading-snug text-tinta-suave">
        {yaNueva
          ? "Ya está escrita con el redactor nuevo. Puedes rehacerla igual."
          : "Escrita con el redactor viejo (el del molde). Rehazla con el nuevo."}
      </p>
      <button
        type="button"
        onClick={reescribir}
        disabled={estado === "trabajando"}
        aria-busy={estado === "trabajando"}
        className="sello w-full"
      >
        {estado === "trabajando" ? "Reescribiendo… (1-2 min)" : "Reescribir la historia"}
      </button>
      {mensaje && (
        <p
          className={`mt-2 text-[13px] leading-snug ${estado === "error" ? "text-tinta" : "text-acento"}`}
          role="status"
        >
          {mensaje}
        </p>
      )}
    </div>
  );
}
