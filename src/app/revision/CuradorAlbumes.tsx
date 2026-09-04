"use client";

// Lista de gestión del curador: todos los discos publicados con su portada,
// para puntuarlos y decidir cuáles entran a la vitrina. Filtro rápido por texto
// y un interruptor para ver solo lo que ya está en la vitrina.

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EstanteEditor, EstrellasCurador, VitrinaToggle } from "./CuradorControls";

export type AlbumCurable = {
  albumId: string;
  title: string;
  artist: string;
  year: number;
  coverUrl: string | null;
  showcase: boolean;
  rating: number | null;
  shelf: string | null;
};

export function CuradorAlbumes({
  albums,
  estantes,
}: {
  albums: AlbumCurable[];
  estantes: string[];
}) {
  const [q, setQ] = useState("");
  const [soloVitrina, setSoloVitrina] = useState(false);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return albums.filter((a) => {
      if (soloVitrina && !a.showcase) return false;
      if (!term) return true;
      return (
        a.title.toLowerCase().includes(term) ||
        a.artist.toLowerCase().includes(term)
      );
    });
  }, [albums, q, soloVitrina]);

  const enVitrina = albums.filter((a) => a.showcase).length;

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar por disco o artista…"
          className="flex-1 rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm outline-none placeholder:text-dim focus:border-album/50"
        />
        <label className="flex items-center gap-2 text-sm text-dim">
          <input
            type="checkbox"
            checked={soloVitrina}
            onChange={(e) => setSoloVitrina(e.target.checked)}
            className="h-4 w-4 accent-album"
          />
          Solo vitrina ({enVitrina})
        </label>
      </div>

      {filtrados.length === 0 ? (
        <p className="rounded-2xl bg-surface p-5 text-sm text-dim">
          Nada que mostrar con ese filtro.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtrados.map((a) => (
            <li
              key={a.albumId}
              className="rounded-2xl border border-white/10 bg-surface p-4"
            >
              <div className="flex items-start gap-3">
                <Link
                  href={`/album/${a.albumId}`}
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white/5"
                >
                  {a.coverUrl && (
                    <Image
                      src={a.coverUrl}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.title}</p>
                  <p className="truncate text-sm text-dim">
                    {a.artist} · {a.year}
                  </p>
                  <div className="mt-3 flex flex-col gap-3">
                    <EstrellasCurador albumId={a.albumId} rating={a.rating} />
                    <VitrinaToggle albumId={a.albumId} inicial={a.showcase} />
                    <EstanteEditor
                      albumId={a.albumId}
                      inicial={a.shelf}
                      sugerencias={estantes}
                    />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
