"use client";

import { useState } from "react";

export function SharePageButton({ title, text }: { title: string; text: string }) {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function share() {
    const url = window.location.href;
    let shown = false;
    const show = (msg: string) => {
      shown = true;
      setFeedback(msg);
      setTimeout(() => setFeedback(null), 2500);
    };
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        show("Enlace copiado ✓");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        show("Enlace copiado ✓");
      } catch {
        if (!shown) show("No se pudo compartir");
      }
    }
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={share}
        className="text-sm text-dim underline underline-offset-4"
      >
        Compartir este disco
      </button>
      {feedback && (
        <p className="mt-2 text-xs text-album-light">{feedback}</p>
      )}
    </div>
  );
}
