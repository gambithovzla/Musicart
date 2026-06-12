"use client";

// Después de escuchar: puntaje (1-10) + comentario libre + canción favorita +
// preguntas de reflexión. Todo alimenta el diario y la memoria del curador.

import { useEffect, useState } from "react";
import Link from "next/link";
import { saveReview, getReview } from "@/app/actions";
import { getDeviceId } from "@/lib/device";
import {
  COMMENT_KEY,
  FAVORITE_KEY,
  RATING_MAX,
  ratingCaption,
  splitAnswers,
} from "@/lib/review";

export function ReflectionForm({
  albumId,
  questions,
  tracks,
}: {
  albumId: string;
  questions: string[];
  tracks: string[]; // títulos del tracklist, para elegir la favorita
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [favorite, setFavorite] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [state, setState] = useState<"loading" | "editing" | "saving" | "saved">(
    "loading",
  );

  useEffect(() => {
    getReview(albumId)
      .then((existing) => {
        if (existing) {
          const { comment: c, favorite: f, reflections } = splitAnswers(existing.answers);
          setRating(existing.rating);
          setComment(c);
          setFavorite(f);
          setAnswers(reflections);
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
    const finalAnswers: Record<string, string> = { ...answers };
    if (comment.trim()) finalAnswers[COMMENT_KEY] = comment.trim();
    if (favorite) finalAnswers[FAVORITE_KEY] = favorite;
    try {
      await saveReview({ deviceId: getDeviceId(), albumId, rating, answers: finalAnswers });
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
          Tu puntaje:{" "}
          <span className="font-semibold text-album-light">{rating}</span>/{RATING_MAX}
        </p>
        {favorite && (
          <p className="mt-1 text-sm text-dim">♪ Tu canción: {favorite}</p>
        )}
        {comment && (
          <p className="font-serif mx-auto mt-3 max-w-sm text-sm italic text-foreground/80">
            “{comment}”
          </p>
        )}
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
        <p className="mb-3 text-sm text-dim">¿Cómo fue la experiencia? (1 a {RATING_MAX})</p>
        <div className="grid grid-cols-10 gap-1.5">
          {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              aria-label={`${n} de ${RATING_MAX}`}
              className={`aspect-square rounded-lg text-sm font-semibold tabular-nums transition-all active:scale-90 ${
                n <= rating
                  ? "bg-album text-black"
                  : "border border-white/15 text-foreground/55"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-sm text-album-light">
          {ratingCaption(rating)}
        </p>
      </div>

      <label className="block">
        <span className="font-serif text-base italic text-foreground/90">
          Escribe lo que quieras sobre el disco
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Lo que te gustó, lo que no, lo que te recordó… Esto me ayuda a conocerte y recomendarte mejor."
          className="mt-2 w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm placeholder:text-white/25 focus:border-album/60 focus:outline-none"
        />
      </label>

      {tracks.length > 0 && (
        <label className="block">
          <span className="font-serif text-base italic text-foreground/90">
            ¿Cuál fue tu canción favorita?
          </span>
          <select
            value={favorite}
            onChange={(e) => setFavorite(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm focus:border-album/60 focus:outline-none"
          >
            <option value="">Sin favorita por ahora</option>
            {tracks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      )}

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
