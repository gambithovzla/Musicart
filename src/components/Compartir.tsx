"use client";

// Compartir una sección o una de sus fichas (9.9, y el Atlas en la 11.6).
//
// Sirve para todas —una sección entera, un disco del canon, el retrato de un
// país— porque el gesto es el mismo y lo único que cambia es qué se dice. La
// imagen bonita la ponen los `opengraph-image.tsx` de cada ruta; esto solo
// entrega el enlace, con Web Share si el teléfono lo tiene y copiándolo si no.
//
// Es un SELLO hueco, no una pastilla: 52px de alto, se hunde al pulsarlo y
// responde al dedo (regla VIII), sin `hover` de por medio.

import { useState, useTransition } from "react";

export function Compartir({
  ruta,
  titulo,
  texto,
  etiqueta = "Compartir",
}: {
  /** Ruta absoluta dentro de la app: "/salon", "/salon/disco/abc". */
  ruta: string;
  titulo: string;
  texto: string;
  etiqueta?: string;
}) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function compartir() {
    setAviso(null);
    startTransition(async () => {
      const url = `${window.location.origin}${ruta}`;
      const mensaje = `${texto}\n${url}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: titulo, text: mensaje, url });
          setAviso("Compartido");
        } else {
          await navigator.clipboard.writeText(mensaje);
          setAviso("Enlace copiado");
        }
      } catch (err) {
        // Cerrar la hoja de compartir no es un fallo: no se avisa de nada.
        if ((err as Error).name === "AbortError") return;
        try {
          await navigator.clipboard.writeText(mensaje);
          setAviso("Enlace copiado");
        } catch {
          setAviso("No se pudo compartir");
        }
      }
      setTimeout(() => setAviso(null), 2500);
    });
  }

  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        onClick={compartir}
        disabled={pendiente}
        aria-busy={pendiente}
        className="sello-hueco"
      >
        <span aria-hidden>↗</span>
        {pendiente ? "Preparando…" : etiqueta}
      </button>
      {aviso && (
        <p className="dato mt-2 text-[11px] uppercase tracking-[0.14em] text-tinta-suave">
          {aviso}
        </p>
      )}
    </div>
  );
}
