"use client";

// Toda la biblioteca, con búsqueda por texto y filtro por género: con el
// catálogo creciendo un disco al día, encontrar uno concreto a mano se vuelve
// difícil — esto lo resuelve sin recargar la página.

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { GenreTags } from "./GenreTags";

export type LibraryAlbum = {
  id: string;
  title: string;
  year: number;
  coverUrl: string | null;
  artistName: string;
  genres: string[];
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function LibraryExplorer({ albums }: { albums: LibraryAlbum[] }) {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string | null>(null);

  const genreCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of albums) {
      for (const g of a.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [albums]);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return albums.filter((a) => {
      if (genre && !a.genres.includes(genre)) return false;
      if (!q) return true;
      return norm(a.title).includes(q) || norm(a.artistName).includes(q);
    });
  }, [albums, query, genre]);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por disco o artista…"
        className="mt-5 w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm text-foreground placeholder:text-dim focus:border-album/50 focus:outline-none"
      />

      {genreCounts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGenre(null)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              genre === null
                ? "bg-album text-black"
                : "bg-white/5 text-dim hover:bg-white/10"
            }`}
          >
            Todos
          </button>
          {genreCounts.map(([g, count]) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenre(genre === g ? null : g)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                genre === g
                  ? "bg-album text-black"
                  : "bg-white/5 text-dim hover:bg-white/10"
              }`}
            >
              {g} · {count}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-surface p-5 text-sm text-dim">
          Ningún disco encaja con esa búsqueda. Probá con otro término o quitá
          el filtro de género.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((a) => (
            <Link
              key={a.id}
              href={`/album/${a.id}`}
              className="group rounded-2xl border border-white/10 bg-surface p-3 transition-transform active:scale-[0.98]"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                {a.coverUrl ? (
                  <Image
                    src={a.coverUrl}
                    alt={`Portada de ${a.title}`}
                    fill
                    sizes="(max-width: 640px) 45vw, 30vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-album-dark">
                    <span className="font-serif text-2xl text-album-light">♪</span>
                  </div>
                )}
              </div>
              <p className="mt-2 truncate text-sm font-medium">{a.title}</p>
              <p className="truncate text-xs text-dim">
                {a.artistName} · {a.year}
              </p>
              {a.genres.length > 0 && (
                <div className="mt-1.5">
                  <GenreTags genres={a.genres.slice(0, 1)} size="xs" />
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
