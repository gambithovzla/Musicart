// Tarjeta compacta del disco que está escuchando hoy el compañero de dueto.

import Image from "next/image";
import Link from "next/link";

type Props = {
  partnerName: string | null;
  album: {
    id: string;
    title: string;
    artist: string;
    year: number;
    coverUrl: string | null;
  };
};

export function AmigoPick({ partnerName, album }: Props) {
  const nombre = partnerName ?? "tu dueto";
  return (
    <section className="mx-6 mt-4 rounded-2xl border border-white/10 bg-surface/60 p-4 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-dim">
        {nombre} escucha hoy
      </p>
      <Link
        href={`/album/${album.id}`}
        className="mt-3 flex items-center gap-3 rounded-xl p-1 transition-colors hover:bg-white/5 active:bg-white/10"
      >
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg shadow">
          {album.coverUrl ? (
            <Image
              src={album.coverUrl}
              alt={album.title}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-album-dark">
              <span className="text-album-light">♪</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-snug">{album.title}</p>
          <p className="truncate text-sm text-dim">
            {album.artist} · {album.year}
          </p>
        </div>
        <span className="shrink-0 text-dim">→</span>
      </Link>
    </section>
  );
}
