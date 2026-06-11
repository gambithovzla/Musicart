"use client";

// Formulario del dueño para crear un disco a demanda: escribe disco + artista
// y la IA lo genera en vivo (1-3 min). Si tarda demasiado, queda en la cola.

import Link from "next/link";
import { useState, useTransition } from "react";
import { generarAlbumAhora, type GenerarAlbumResult } from "./actions";

export function GenerarDiscoForm() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [publish, setPublish] = useState(true);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<GenerarAlbumResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !title.trim() || !artist.trim()) return;
    setResult(null);
    setError(null);
    startTransition(async () => {
      try {
        const r = await generarAlbumAhora({ title, artist, publish });
        setResult(r);
        if (r.estado === "published" || r.estado === "draft") {
          setTitle("");
          setArtist("");
        }
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  const tono =
    result?.estado === "published"
      ? "border-album/30 bg-album/10 text-album-light"
      : "border-white/15 bg-surface text-foreground/90";

  return (
    <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
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
        Publicar al instante si pasa la verificación (si no, queda en borradores)
      </label>

      <button
        type="submit"
        disabled={pending || !title.trim() || !artist.trim()}
        className="self-start rounded-full bg-album px-6 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
      >
        {pending ? "Creando… (1-3 min, no cierres la pestaña)" : "Crear disco con IA"}
      </button>

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
        Busca los datos reales (MusicBrainz, Wikipedia, Last.fm…), escribe la
        historia y la verifica contra los hechos. Cada disco se genera una sola
        vez y queda cacheado para todos.
      </p>
    </form>
  );
}
