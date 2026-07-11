"use client";

// Compartir la vitrina: usa Web Share si existe, o copia el enlace. La imagen
// bonita para redes la aporta opengraph-image.tsx (colage de carátulas).

import { useState, useTransition } from "react";

export function ShareVitrina() {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function share() {
    setFeedback(null);
    startTransition(async () => {
      const url = `${window.location.origin}/vitrina`;
      const text = `Mi vitrina de discos en Musicart — las carátulas que atesoro, cada una con su historia.\n${url}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: "La vitrina · Musicart", text, url });
          setFeedback("Compartido ✓");
        } else {
          await navigator.clipboard.writeText(text);
          setFeedback("Enlace copiado ✓");
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        try {
          await navigator.clipboard.writeText(text);
          setFeedback("Enlace copiado ✓");
        } catch {
          setFeedback("No se pudo compartir");
        }
      }
      setTimeout(() => setFeedback(null), 2500);
    });
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={share}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-surface px-5 py-2.5 text-sm font-medium transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        <span aria-hidden>↗</span>
        {pending ? "Preparando…" : "Compartir mi vitrina"}
      </button>
      {feedback && <p className="mt-2 text-xs text-album-light">{feedback}</p>}
    </div>
  );
}
