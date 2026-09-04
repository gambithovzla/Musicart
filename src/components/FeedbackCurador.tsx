"use client";

// Cuéntale al curador. Dos botones:
//   · Guardar (gratis): tu comentario entra en tu memoria → te conozco mejor.
//   · Enviar y oír su respuesta (cuesta): el melómano te responde y te sugiere música.

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDeviceId } from "@/lib/device";
import {
  guardarComentario,
  pedirRespuestaMelomano,
} from "@/app/album/[id]/feedback-actions";
import type { ChatQuota } from "@/lib/album-chat";

const MAX_CHARS = 280;
const MIN_CHARS = 3;

export function FeedbackCurador({
  albumId,
  albumTitle,
  albumArtist,
  initialQuota,
}: {
  albumId: string;
  albumTitle: string;
  albumArtist: string;
  initialQuota: ChatQuota | null;
}) {
  const [quota, setQuota] = useState(initialQuota);
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFree, startFree] = useTransition();
  const [pendingPaid, startPaid] = useTransition();

  const pending = pendingFree || pendingPaid;
  const puedeResponder = (quota?.remainingToday ?? 0) > 0;
  const base = { albumId, albumTitle, albumArtist, deviceId: getDeviceId() };

  function guardar() {
    const t = text.trim();
    if (t.length < MIN_CHARS || pending) return;
    setError(null);
    setAnswer(null);
    startFree(async () => {
      const r = await guardarComentario({ ...base, text: t });
      if (r.ok) {
        setSaved(true);
        setText("");
      } else {
        setError(r.error ?? "No pude guardarlo. Inténtalo de nuevo.");
      }
    });
  }

  function responder() {
    const t = text.trim();
    if (t.length < MIN_CHARS || pending) return;
    setError(null);
    setSaved(false);
    setAnswer(null);
    startPaid(async () => {
      const r = await pedirRespuestaMelomano({ ...base, text: t });
      if (r.quota) setQuota(r.quota);
      if (r.ok) {
        setAnswer(r.answer);
        setText("");
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <section className="mt-12">
      <h2 className="flex items-baseline gap-3 border-b border-white/10 pb-3">
        <span className="text-xs tabular-nums tracking-widest text-album">✶</span>
        <span className="font-serif text-xl font-medium">Cuéntale al curador</span>
      </h2>
      <p className="mt-2 text-sm text-dim">
        ¿Qué te hizo sentir? Guárdalo y te conoceré mejor para lo de mañana —
        gratis. O pídeme que te responda y te sugiera más música.
      </p>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value.slice(0, MAX_CHARS));
          if (saved) setSaved(false);
        }}
        rows={3}
        disabled={pending}
        placeholder="«La tercera canción me puso la piel de gallina, esa guitarra…»"
        className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-surface px-4 py-3 text-sm placeholder:text-white/25 focus:border-album/50 focus:outline-none disabled:opacity-50"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={pending || text.trim().length < MIN_CHARS}
          className="rounded-xl border border-white/15 bg-surface px-4 py-2.5 text-sm font-medium text-foreground/90 transition-colors hover:border-album/40 disabled:opacity-40"
        >
          {pendingFree ? "Guardando…" : "Guardar (gratis)"}
        </button>
        <button
          type="button"
          onClick={responder}
          disabled={pending || text.trim().length < MIN_CHARS || !puedeResponder}
          className="rounded-xl bg-album px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
        >
          {pendingPaid ? "Pensando…" : "Enviar y oír su respuesta"}
        </button>
        {quota && puedeResponder && (
          <span className="text-xs text-dim">
            {quota.isPro
              ? `${quota.remainingToday} respuestas hoy`
              : `${quota.remainingToday} de ${quota.limitToday} respuestas gratis hoy`}
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {saved && (
          <motion.p
            key="saved"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-sm text-album-light"
          >
            Guardado ✓ — cada cosa que me cuentas afina lo que te recomiendo.
          </motion.p>
        )}
        {answer && (
          <motion.div
            key="answer"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-2xl border border-album/25 bg-album/5 px-5 py-4"
          >
            <p className="font-serif text-[15px] leading-relaxed text-foreground/95">
              {answer}
            </p>
            <p className="mt-2 text-xs text-dim">Lo que me dijiste ya quedó en tu memoria.</p>
          </motion.div>
        )}
        {error && (
          <motion.p
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-sm text-red-300/90"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {quota && !puedeResponder && (
        <p className="mt-3 text-xs text-dim">
          Te quedaste sin respuestas por hoy, pero{" "}
          <span className="text-foreground/80">guardar tu comentario siempre es gratis</span>.
        </p>
      )}
    </section>
  );
}
