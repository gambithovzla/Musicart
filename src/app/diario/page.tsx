// El diario del melómano: historial de viajes con racha de descubrimiento.
// Fase 3.3: con sesión muestra todas las reseñas de la cuenta.

import Image from "next/image";
import Link from "next/link";
import { getJournal } from "@/app/actions";
import { getListenerIdentity } from "@/lib/identity";
import { getMusicalThread } from "@/lib/musical-thread";
import { RATING_MAX, splitAnswers } from "@/lib/review";

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

// Latido semanal: lo de los últimos 7 días, sin IA ni queries extra (deriva del
// diario que ya cargamos). La rebobinada mensual sigue dando la carta con IA.
function recapSemanal(entries: Entry[]): {
  discos: number;
  mejor: Entry | null;
  cancion: string | null;
} | null {
  const ahora = Date.now();
  const semana = entries.filter(
    (e) => ahora - new Date(e.date).getTime() <= 7 * 86_400_000,
  );
  if (semana.length === 0) return null;
  const mejor = semana.reduce<Entry>((a, b) => (b.rating > a.rating ? b : a), semana[0]);
  const { favorite } = splitAnswers(mejor.answers);
  return { discos: semana.length, mejor, cancion: favorite.trim() || null };
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
  const identity = await getListenerIdentity();
  const [entries, thread] = await Promise.all([
    getJournal(),
    getMusicalThread(identity),
  ]);
  const streak = computeStreak(entries);
  const recap = recapSemanal(entries);

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
        {recap && (
          <div className="mt-6 rounded-2xl border border-album/25 bg-album/5 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-album-light/80">
              Tu semana musical
            </p>
            <p className="mt-2 text-sm text-foreground/90">
              {recap.discos} {recap.discos === 1 ? "disco" : "discos"} en los últimos 7 días
              {streak > 1 && <span className="text-album-light"> · 🔥 {streak} seguidos</span>}.
            </p>
            {recap.mejor && (
              <p className="mt-1 text-sm text-dim">
                Lo que más te marcó:{" "}
                <span className="text-foreground/90">«{recap.mejor.title}»</span> de{" "}
                {recap.mejor.artist}{" "}
                <span className="text-album-light">
                  {recap.mejor.rating}/{RATING_MAX}
                </span>
                {recap.cancion && <span className="text-album-light"> · ♪ {recap.cancion}</span>}
              </p>
            )}
          </div>
        )}

        {thread && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-album/10 to-transparent p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-album-light/80">
              El hilo de tu vida musical
            </p>
            <p className="font-serif mt-3 text-base leading-relaxed text-foreground/90">
              {thread.content}
            </p>
          </div>
        )}
        {entries.length > 0 && (
          <Link
            href="/rebobinada"
            className="mt-4 flex items-center justify-between rounded-2xl border border-album/25 bg-album/5 px-4 py-3 text-sm transition-transform active:scale-[0.99]"
          >
            <span>
              <span className="font-serif font-medium text-album-light">
                Tu rebobinada
              </span>
              <span className="mt-0.5 block text-xs text-dim">
                La carta de tu mes musical, escrita para ti
              </span>
            </span>
            <span aria-hidden className="text-album-light">
              →
            </span>
          </Link>
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
          const { comment, favorite, reflections } = splitAnswers(e.answers);
          const reflection =
            comment.trim() || Object.values(reflections).find((a) => a.trim());
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
                <p className="mt-1 text-sm">
                  <span className="font-semibold text-album">{e.rating}</span>
                  <span className="text-dim">/{RATING_MAX}</span>
                </p>
                {favorite && (
                  <p className="mt-0.5 truncate text-xs text-album-light">♪ {favorite}</p>
                )}
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
