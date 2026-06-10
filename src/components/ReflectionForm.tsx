"use client";

// Después de escuchar: rating + preguntas de reflexión.
// Alimenta el diario del melómano y las recomendaciones futuras.

import { useEffect, useState } from "react";
import Link from "next/link";
import { saveReview, getReview } from "@/app/actions";
import { getDeviceId } from "@/lib/device";

export function ReflectionForm({
  albumId,
  questions,
}: {
  albumId: string;
  questions: string[];
}) {
  const [rating, setRating] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [state, setState] = useState<"loading" | "editing" | "saving" | "saved">(
    "loading",
  );

  useEffect(() => {
    const deviceId = getDeviceId();
    getReview(deviceId, albumId)
      .then((existing) => {
        if (existing) {
          setRating(existing.rating);
          setAnswers(existing.answers);
          setState("saved");
        } else {
          setState("editing");
        }
      })
      .catch(() => setState("editing"));
  }, [albumId]);

  async function submit() {
    if (rating === 0) return;
    setState("saving");
    try {
      await saveReview({ deviceId: getDeviceId(), albumId, rating, answers });
      setState("saved");
    } catch {
      setState("editing");
    }
  }

  if (state === "loading") {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface" />;
  }

  if (state === "saved") {
    return (
      <div className="rounded-2xl border border-album/30 bg-album/10 p-6 text-center">
        <p className="font-serif text-lg text-album-light">
          Guardado en tu diario ✓
        </p>
        <p className="mt-2 text-sm text-dim">
          Tu calificación: {"★".repeat(rating)}
        </p>
        <div className="mt-4 flex justify-center gap-4 text-sm">
          <button
            onClick={() => setState("editing")}
            className="text-dim underline underline-offset-4"
          >
            Editar
          </button>
          <Link href="/diario" className="text-album-light underline underline-offset-4">
            Ver mi diario
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-3 text-sm text-dim">¿Cómo fue la experiencia?</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              aria-label={`${n} estrellas`}
              className={`text-4xl transition-transform active:scale-90 ${
                n <= rating ? "text-album" : "text-white/15"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {questions.map((q) => (
        <label key={q} className="block">
          <span className="font-serif text-base italic text-foreground/90">{q}</span>
          <textarea
            value={answers[q] ?? ""}
            onChange={(e) => setAnswers((a) => ({ ...a, [q]: e.target.value }))}
            rows={2}
            placeholder="Opcional…"
            className="mt-2 w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm placeholder:text-white/25 focus:border-album/60 focus:outline-none"
          />
        </label>
      ))}

      <button
        onClick={submit}
        disabled={rating === 0 || state === "saving"}
        className="rounded-2xl bg-album px-6 py-4 text-base font-semibold text-black transition-all active:scale-[0.98] disabled:opacity-30"
      >
        {state === "saving" ? "Guardando…" : "Guardar en mi diario"}
      </button>
    </div>
  );
}
