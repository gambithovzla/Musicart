"use client";

// Tarjeta de pregunta del día: micro-encuesta para conocer mejor al oyente.
// Aparece en el home una vez por día. Se responde tocando botones;
// hay campo libre opcional para quien quiera extenderse.

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { answerCuriosity } from "@/app/actions";
import { getDeviceId } from "@/lib/device";
import type { CuriosityQuestion } from "@/lib/curiosities";

export function CuriosityCard({
  question,
  dateKey,
}: {
  question: CuriosityQuestion;
  dateKey: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [extra, setExtra] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm(option: string) {
    setSelected(option);
    startTransition(async () => {
      await answerCuriosity(getDeviceId(), {
        id: question.id,
        answer: option,
        extra: extra.trim() || undefined,
        date: dateKey,
      });
      setDone(true);
    });
  }

  return (
    <AnimatePresence>
      {!done && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.5 }}
          className="mx-auto mt-8 max-w-xs"
        >
          <p className="text-center text-[0.65rem] uppercase tracking-[0.25em] text-dim">
            Cuéntame algo
          </p>
          <p className="font-serif mt-2 text-center text-base leading-snug">
            {question.text}
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {question.options.map((opt) => (
              <button
                key={opt}
                type="button"
                disabled={pending}
                onClick={() => confirm(opt)}
                className={`rounded-full border px-4 py-2 text-sm transition-all active:scale-95 disabled:opacity-50 ${
                  selected === opt
                    ? "border-album bg-album font-semibold text-black"
                    : "border-white/20 bg-surface text-foreground/80 hover:border-white/40"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {!selected && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-3 text-center"
              >
                {!showExtra ? (
                  <button
                    type="button"
                    onClick={() => setShowExtra(true)}
                    className="text-xs text-dim underline underline-offset-4"
                  >
                    Quiero extenderme →
                  </button>
                ) : (
                  <textarea
                    autoFocus
                    value={extra}
                    onChange={(e) => setExtra(e.target.value.slice(0, 200))}
                    placeholder="Cuéntame más…"
                    rows={2}
                    className="mt-1 w-full resize-none rounded-2xl border border-white/10 bg-surface px-4 py-2.5 text-sm placeholder:text-white/25 focus:border-album/50 focus:outline-none"
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {selected && (
            <p className="mt-3 text-center text-xs text-album-light">
              {pending ? "Guardando…" : "✓ Guardado"}
            </p>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
