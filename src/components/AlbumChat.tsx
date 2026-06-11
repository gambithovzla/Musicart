"use client";

// Pregúntale al disco — con límites visibles para el oyente.

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { askDossierQuestion } from "@/app/album/[id]/chat-actions";
import { getDeviceId } from "@/lib/device";
import type { ChatQuota } from "@/lib/album-chat";

const MAX_CHARS = 240;

export function AlbumChat({
  albumId,
  albumTitle,
  suggestedQuestions,
  initialQuota,
}: {
  albumId: string;
  albumTitle: string;
  suggestedQuestions: string[];
  initialQuota: ChatQuota | null;
}) {
  const [quota, setQuota] = useState(initialQuota);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!quota || (quota.remainingToday <= 0 && !answer)) return null;

  function submit(q: string) {
    const text = q.trim();
    if (!text || pending) return;
    setError(null);
    setAnswer(null);
    startTransition(async () => {
      const result = await askDossierQuestion(albumId, text, getDeviceId());
      if (result.quota) setQuota(result.quota);
      if (result.ok) {
        setAnswer(result.answer);
        setQuestion("");
      } else {
        setError(result.error);
      }
    });
  }

  const canAsk = quota.remainingToday > 0 && quota.remainingAlbum > 0;

  return (
    <section className="mt-12">
      <h2 className="flex items-baseline gap-3 border-b border-white/10 pb-3">
        <span className="text-xs tabular-nums tracking-widest text-album">💬</span>
        <span className="font-serif text-xl font-medium">Pregúntale al disco</span>
      </h2>
      <p className="mt-2 text-sm text-dim">
        Solo sobre «{albumTitle}». Respuestas verificadas, no inventos.
        {quota.isPro ? (
          <span className="text-album-light">
            {" "}
            · {quota.remainingToday} preguntas hoy
          </span>
        ) : (
          <span>
            {" "}
            · {quota.remainingAlbum} de {quota.limitAlbum} en este disco hoy
          </span>
        )}
      </p>

      {suggestedQuestions.length > 0 && canAsk && (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestedQuestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() => submit(s)}
              className="rounded-full border border-white/15 bg-surface px-3 py-1.5 text-left text-xs text-foreground/85 transition-colors hover:border-album/40 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {canAsk && (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(question);
          }}
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, MAX_CHARS))}
            placeholder="¿Por qué grabaron este disco así?"
            disabled={pending}
            maxLength={MAX_CHARS}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm placeholder:text-white/25 focus:border-album/50 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={pending || question.trim().length < 8}
            className="shrink-0 rounded-xl bg-album px-4 py-3 text-sm font-semibold text-black disabled:opacity-40"
          >
            {pending ? "…" : "Preguntar"}
          </button>
        </form>
      )}

      <AnimatePresence mode="wait">
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

      {!canAsk && !answer && (
        <p className="mt-4 text-sm text-dim">
          {quota.remainingToday <= 0
            ? "Límite de preguntas de hoy. Mañana puedes seguir explorando."
            : "Ya preguntaste todo lo que podías sobre este disco hoy."}
        </p>
      )}
    </section>
  );
}
