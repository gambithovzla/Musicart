// Fase 5.2 — La rebobinada: tu mes musical contado como una carta.

import Link from "next/link";
import { getListenerIdentity } from "@/lib/identity";
import { getRewindForPage } from "@/lib/rewind";

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

  const { rewind, inProgress } = data;
  const { stats } = rewind;

  return (
    <main className="px-6 pb-16 pt-12">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-dim">
          {inProgress ? "Tu mes va así" : "Tu rebobinada"}
        </p>
        <h1 className="font-serif mt-2 text-3xl font-semibold capitalize">
          {stats.monthLabel}
        </h1>
      </header>

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

      {stats.bestAlbum && (
        <div className="mt-3 rounded-xl border border-white/10 bg-surface px-4 py-3 text-center">
          <p className="text-xs text-dim">El disco de tu mes</p>
          <p className="font-serif mt-1 text-lg font-medium">
            «{stats.bestAlbum.title}»{" "}
            <span className="font-normal text-dim">· {stats.bestAlbum.artist}</span>
          </p>
        </div>
      )}

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
    </main>
  );
}
