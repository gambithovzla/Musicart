"use client";

// Generación de catálogo desde el panel del dueño. Dos caminos:
//  1) Un botón: la IA elige qué disco falta y lo crea (sin escribir nada).
//  2) Manual (opcional): escribir disco + artista concretos.
// En ambos, la generación es en vivo (1-3 min) con la cola como red de seguridad.

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  generarAlbumAhora,
  generarDiscoSugerido,
  type GenerarAlbumResult,
} from "./actions";

export function GenerarDiscoForm() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [publish, setPublish] = useState(true);
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<"ia" | "manual" | null>(null);
  const [result, setResult] = useState<GenerarAlbumResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(task: () => Promise<GenerarAlbumResult>, cual: "ia" | "manual") {
    if (pending) return;
    setResult(null);
    setError(null);
    setRunning(cual);
    startTransition(async () => {
      try {
        const r = await task();
        setResult(r);
        if (cual === "manual" && (r.estado === "published" || r.estado === "draft")) {
          setTitle("");
          setArtist("");
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setRunning(null);
      }
    });
  }

  const tono =
    result?.estado === "published"
      ? "border-album/30 bg-album/10 text-album-light"
      : "border-white/15 bg-surface text-foreground/90";

  return (
    <div className="mt-5 flex flex-col gap-5">
      {/* Camino 1: la IA elige y crea. */}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => generarDiscoSugerido(), "ia")}
        className="rounded-2xl bg-album px-6 py-4 text-base font-semibold text-black shadow-lg shadow-album/30 transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {running === "ia"
          ? "La IA está eligiendo y creando… (1-3 min, no cierres)"
          : "✨ Que la IA elija y cree un disco"}
      </button>
      <p className="-mt-2 text-xs text-dim">
        La IA decide qué disco le falta al catálogo —según los huecos, lo que la
        gente puntúa alto y la diversidad— lo genera y lo deja publicado. Tú solo
        tocas el botón.
      </p>

      {/* Camino 2: manual, opcional. */}
      <details className="rounded-2xl border border-white/10 bg-surface/60 px-4 py-3">
        <summary className="cursor-pointer text-sm text-dim">
          ¿Tienes uno en mente? Añádelo tú →
        </summary>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Disco (p. ej. Kind of Blue)"
              disabled={pending}
              className="flex-1 rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm outline-none placeholder:text-dim focus:border-album/50 disabled:opacity-50"
            />
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Artista (p. ej. Miles Davis)"
              disabled={pending}
              className="flex-1 rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm outline-none placeholder:text-dim focus:border-album/50 disabled:opacity-50"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-dim">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
              disabled={pending}
              className="h-4 w-4 accent-album"
            />
            Publicar al instante si pasa la verificación
          </label>
          <button
            type="button"
            disabled={pending || !title.trim() || !artist.trim()}
            onClick={() => run(() => generarAlbumAhora({ title, artist, publish }), "manual")}
            className="self-start rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-foreground/90 disabled:opacity-50"
          >
            {running === "manual" ? "Creando… (1-3 min)" : "Crear este disco"}
          </button>
        </div>
      </details>

      {result && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${tono}`}>
          <p>{result.message}</p>
          {result.albumId && (
            <Link
              href={`/album/${result.albumId}`}
              className="mt-2 inline-block underline underline-offset-4"
            >
              Ver el disco →
            </Link>
          )}
        </div>
      )}
      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <p className="text-xs text-dim">
        Cada disco se genera una sola vez (busca datos reales, escribe la historia
        y la verifica) y queda cacheado para todos. Si la creación en vivo se
        corta, queda en la cola y el robot la termina.
      </p>
    </div>
  );
}
