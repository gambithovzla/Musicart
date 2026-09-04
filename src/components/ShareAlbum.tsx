"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  albumId: string;
  title: string;
  artist: string;
  /** Gancho o razón personalizada para el mensaje de compartir */
  subtitle?: string | null;
  variant?: "button" | "link";
};

export function ShareAlbum({
  albumId,
  title,
  artist,
  subtitle,
  variant = "button",
}: Props) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function buildMessage(origin: string) {
    const url = `${origin}/compartir/${albumId}`;
    const lead = subtitle?.trim()
      ? `Hoy en Musicart: "${title}" de ${artist}. ${subtitle.trim()}`
      : `Descubre "${title}" de ${artist} en Musicart — un disco, una historia.`;
    return { url, text: `${lead}\n${url}`, title: `${title} — ${artist}` };
  }

  function share() {
    setFeedback(null);
    startTransition(async () => {
      const { url, text, title: shareTitle } = buildMessage(window.location.origin);
      try {
        if (navigator.share) {
          await navigator.share({ title: shareTitle, text, url });
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

  const className =
    variant === "link"
      ? "text-sm text-dim underline underline-offset-4 disabled:opacity-50"
      : "flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-surface px-5 py-3.5 text-sm font-medium transition-transform active:scale-[0.98] disabled:opacity-50";

  return (
    <div>
      <button type="button" onClick={share} disabled={pending} className={className}>
        {pending ? "Preparando…" : variant === "link" ? "Compartir este disco →" : "Compartir mi disco de hoy"}
      </button>
      <AnimatePresence>
        {feedback && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 text-center text-xs text-album-light"
          >
            {feedback}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
