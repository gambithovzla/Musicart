// El diario del melómano: historial de viajes con racha de descubrimiento.
// Fase 3.3: con sesión muestra todas las reseñas de la cuenta.

import Image from "next/image";
import Link from "next/link";
import { getJournal } from "@/app/actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Diario · Musicart" };

type Entry = Awaited<ReturnType<typeof getJournal>>[number];

function localDay(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeStreak(entries: Entry[]): number {
  const days = new Set(entries.map((e) => localDay(e.date)));
  let streak = 0;
  const cursor = new Date();
  if (!days.has(localDay(cursor.toISOString()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(localDay(cursor.toISOString()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default async function DiarioPage() {
  const entries = await getJournal();
  const streak = computeStreak(entries);

  return (
    <main className="px-6 pt-12">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-dim">Tu diario</p>
        <h1 className="font-serif mt-2 text-3xl font-semibold">
          Discos que ya viajaste
        </h1>
        {entries.length > 0 && (
          <p className="mt-3 text-sm text-dim">
            {entries.length} {entries.length === 1 ? "disco" : "discos"} en tu diario
            {streak > 1 && (
              <span className="ml-2 rounded-full bg-album/15 px-3 py-1 text-album-light">
                🔥 {streak} días seguidos
              </span>
            )}
          </p>
        )}
      </header>

      {entries.length === 0 && (
        <div className="mt-16 text-center">
          <p className="font-serif text-xl italic text-dim">
            Tu diario está esperando su primera entrada.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-2xl bg-album px-6 py-3 font-semibold text-black"
          >
            Descubre el disco de hoy
          </Link>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-4 pb-10">
        {entries.map((e) => {
          const reflection = Object.values(e.answers).find((a) => a.trim());
          return (
            <Link
              key={e.albumId}
              href={`/album/${e.albumId}`}
              className="flex gap-4 rounded-2xl border border-white/8 bg-surface p-4 transition-transform active:scale-[0.99]"
            >
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                {e.coverUrl ? (
                  <Image
                    src={e.coverUrl}
                    alt={e.title}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-white/5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{e.title}</p>
                <p className="truncate text-sm text-dim">
                  {e.artist} · {e.year}
                </p>
                <p className="mt-1 text-sm text-album">
                  {"★".repeat(e.rating)}
                  <span className="text-white/15">{"★".repeat(5 - e.rating)}</span>
                </p>
                {reflection && (
                  <p className="font-serif mt-1 truncate text-sm italic text-foreground/70">
                    “{reflection}”
                  </p>
                )}
              </div>
              <span className="self-center text-xs text-dim">
                {new Date(e.date).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
