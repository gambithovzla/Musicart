"use client";

import { useState, useTransition } from "react";
import { generateDossierTts, generateMissingTts } from "./actions";

type DossierRow = {
  id: string;
  albumId: string;
  title: string;
  artist: string;
  hasAudio: boolean;
};

export function TtsControls({
  dossiers,
  missingCount,
}: {
  dossiers: DossierRow[];
  missingCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(task: () => Promise<{ message: string; ok: boolean }>, id?: string) {
    setMessage(null);
    setError(null);
    setActiveId(id ?? "batch");
    startTransition(async () => {
      try {
        const result = await task();
        if (result.ok) setMessage(result.message);
        else setError(result.message);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setActiveId(null);
      }
    });
  }

  const busy = pending;

  return (
    <div className="mt-5 flex flex-col gap-3">
      {missingCount > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => generateMissingTts(5))}
          className="self-start rounded-full bg-album px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
        >
          {activeId === "batch"
            ? "Generando audio… (~1 min por disco)"
            : `Generar audio faltante (${missingCount})`}
        </button>
      )}

      <ul className="flex flex-col gap-2">
        {dossiers.map((d) => (
          <li
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm"
          >
            <div className="min-w-0">
              <span className="font-medium">{d.title}</span>
              <span className="text-dim"> · {d.artist}</span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className={d.hasAudio ? "text-album-light" : "text-dim"}>
                {d.hasAudio ? "✓ audio" : "sin audio"}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => generateDossierTts(d.id), d.id)}
                className="rounded-full border border-white/15 px-4 py-1.5 text-foreground/90 disabled:opacity-50"
              >
                {activeId === d.id
                  ? "Generando…"
                  : d.hasAudio
                    ? "Regenerar"
                    : "Generar"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {message && (
        <p className="rounded-xl border border-album/30 bg-album/10 px-4 py-3 text-sm text-album-light">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <p className="text-xs text-dim">
        Cuesta ~0,08 USD por disco (OpenAI TTS). En local guarda en{" "}
        <code className="text-foreground/70">public/audio/</code>; en Vercel usa
        Blob si está configurado.
      </p>
    </div>
  );
}
