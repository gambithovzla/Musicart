// Fase 5.2 — La rebobinada: tu mes musical contado como una carta.

import Image from "next/image";
import Link from "next/link";
import { getListenerIdentity } from "@/lib/identity";
import { getRewindForPage } from "@/lib/rewind";
import { albumThemeStyle } from "@/lib/theme";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tu rebobinada · Musicart" };

export default async function RebobinadaPage() {
  const identity = await getListenerIdentity();
  const data = await getRewindForPage(identity);

  if (!data) {
    return (
      <main className="flex min-h-[80dvh] flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-dim">Rebobinada</p>
        <h1 className="font-serif text-2xl">Aún no hay viaje que contar</h1>
        <p className="text-sm leading-relaxed text-dim">
          Lee tu primer dossier y deja una reseña: al final del mes, la IA te
          escribirá una carta con todo lo que descubriste.
        </p>
        <Link
          href="/"
          className="mt-2 rounded-2xl bg-album px-6 py-3 font-semibold text-black"
        >
          Ir a mi disco de hoy
        </Link>
      </main>
    );
  }

  const { rewind, inProgress, coverUrl, palette } = data;
  const { stats } = rewind;

  return (
    <main style={albumThemeStyle(palette)} className="relative">
      {/* Fondo teñido con los colores del disco del mes, como en el dossier */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[50dvh]"
        style={{
          background:
            "linear-gradient(to bottom, var(--album-dark) 0%, transparent 100%)",
          opacity: 0.5,
        }}
      />

      <div className="relative px-6 pb-16 pt-12">
        <header className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-dim">
            {inProgress ? "Tu mes va así" : "Tu rebobinada"}
          </p>
          <h1 className="font-serif mt-2 text-3xl font-semibold capitalize">
            {stats.monthLabel}
          </h1>
        </header>

        {/* La carátula del disco del mes: el sello de la carta */}
        {stats.bestAlbum && (
          <div className="mx-auto mt-7 flex flex-col items-center">
            <div className="relative">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-6 -z-10 rounded-full opacity-60 blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle, var(--album-vibrant), transparent 70%)",
                }}
              />
              <div className="relative aspect-square w-32 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
                {coverUrl ? (
                  <Image
                    src={coverUrl}
                    alt={`Portada de ${stats.bestAlbum.title}`}
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-album-dark">
                    <span className="font-serif text-3xl text-album-light">♪</span>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-album-light">
              El disco de tu mes
            </p>
            {stats.bestAlbum.albumId ? (
              <Link
                href={`/album/${stats.bestAlbum.albumId}`}
                className="font-serif mt-1 text-center text-base font-medium underline-offset-4 hover:underline"
              >
                «{stats.bestAlbum.title}»{" "}
                <span className="font-normal text-dim">· {stats.bestAlbum.artist}</span>
              </Link>
            ) : (
              <p className="font-serif mt-1 text-center text-base font-medium">
                «{stats.bestAlbum.title}»{" "}
                <span className="font-normal text-dim">· {stats.bestAlbum.artist}</span>
              </p>
            )}
          </div>
        )}

        {/* La carta */}
        <div className="mt-8 rounded-2xl border border-album/25 bg-album/5 px-6 py-7">
          <p className="font-serif whitespace-pre-line text-[1.05rem] italic leading-relaxed text-foreground/95">
            {rewind.content}
          </p>
          <p className="mt-5 text-right text-xs uppercase tracking-[0.2em] text-album-light">
            — Musicart
          </p>
        </div>

        {/* Los números detrás de la carta */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-surface px-4 py-3 text-center">
            <p className="font-serif text-2xl font-semibold tabular-nums">
              {stats.albumsRead}
            </p>
            <p className="mt-1 text-xs text-dim">
              {stats.albumsRead === 1 ? "dossier leído" : "dossiers leídos"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-surface px-4 py-3 text-center">
            <p className="font-serif text-2xl font-semibold tabular-nums">
              {stats.reviews.length}
            </p>
            <p className="mt-1 text-xs text-dim">
              {stats.reviews.length === 1 ? "reseña" : "reseñas"}
            </p>
          </div>
        </div>

        {stats.topMoods.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {stats.topMoods.map((m) => (
              <span
                key={m}
                className="rounded-full bg-album/15 px-4 py-1.5 text-sm text-album-light"
              >
                {m}
              </span>
            ))}
          </div>
        )}

        {inProgress && (
          <p className="mt-6 text-center text-xs leading-relaxed text-dim">
            Cuando termine el mes, la IA te escribirá la carta completa de este
            viaje. Sigue el ritual.
          </p>
        )}

        <Link
          href="/diario"
          className="mt-8 block text-center text-sm text-dim underline underline-offset-4"
        >
          Ver mi diario completo →
        </Link>
      </div>
    </main>
  );
}
