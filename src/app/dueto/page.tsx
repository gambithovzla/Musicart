// Fase 5.5 — Modo dueto: un disco compartido a la semana.

import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { findPairForUser, getWeeklyDuetPick, weekLabel, weekKey } from "@/lib/duet";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modo dueto · Musicart" };

export default async function DuetoPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <main className="flex min-h-[80dvh] flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-dim">Modo dueto</p>
        <h1 className="font-serif text-2xl">Hace falta una cuenta</h1>
        <p className="text-sm leading-relaxed text-dim">
          El dueto vincula dos personas con sesión iniciada. Entra y crea o
          acepta una invitación desde tu perfil.
        </p>
        <Link
          href="/entrar"
          className="mt-2 rounded-2xl bg-album px-6 py-3 font-semibold text-black"
        >
          Entrar
        </Link>
      </main>
    );
  }

  const pair = await findPairForUser(userId);

  if (!pair) {
    return (
      <main className="flex min-h-[80dvh] flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-dim">Modo dueto</p>
        <h1 className="font-serif text-2xl">Aún no hay dueto</h1>
        <p className="text-sm leading-relaxed text-dim">
          Invita a alguien o introduce su código en tu perfil. Cada semana os
          proponemos un disco en la intersección de vuestros gustos.
        </p>
        <Link
          href="/perfil"
          className="mt-2 rounded-2xl bg-album px-6 py-3 font-semibold text-black"
        >
          Ir a mi perfil
        </Link>
      </main>
    );
  }

  if (pair.status === "pending") {
    const isInviter = pair.userAId === userId;
    return (
      <main className="px-6 pb-16 pt-12 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-dim">Modo dueto</p>
        <h1 className="font-serif mt-2 text-3xl font-semibold">
          {isInviter ? "Esperando compañía" : "Invitación pendiente"}
        </h1>
        {isInviter ? (
          <>
            <p className="mt-4 text-sm text-dim">
              Comparte tu código. Cuando se una, veréis aquí el disco de la
              semana.
            </p>
            <p className="font-mono mt-6 text-4xl font-bold tracking-[0.2em] text-album-light">
              {pair.inviteCode}
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-dim">
            Acepta la invitación desde tu perfil para activar el dueto.
          </p>
        )}
        <Link
          href="/perfil"
          className="mt-8 inline-block text-sm text-dim underline underline-offset-4"
        >
          Volver al perfil
        </Link>
      </main>
    );
  }

  const pick = await getWeeklyDuetPick(userId);
  if (!pick) {
    return (
      <main className="px-8 py-16 text-center">
        <p className="text-sm text-dim">No hay disco de dueto disponible todavía.</p>
        <Link href="/perfil" className="mt-4 inline-block text-sm text-album-light underline">
          Ir al perfil
        </Link>
      </main>
    );
  }

  const { dossier, reason, partner, sharedMoments, sharedSeeks } = pick;
  const { album } = dossier;
  const partnerLabel = partner.name ?? partner.email.split("@")[0];

  return (
    <main className="px-6 pb-16 pt-12">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-dim">Modo dueto</p>
        <h1 className="font-serif mt-2 text-3xl font-semibold">
          Vuestro disco de la semana
        </h1>
        <p className="mt-2 text-sm text-dim capitalize">
          {pick.weekLabel || weekLabel(weekKey())}
        </p>
        <p className="mt-1 text-xs text-dim">
          Con {partnerLabel}
        </p>
      </header>

      <Link
        href={`/album/${album.id}`}
        className="mt-8 block overflow-hidden rounded-2xl border border-album/25 bg-album/5 transition-transform active:scale-[0.99]"
      >
        <div className="relative mx-auto aspect-square max-w-xs">
          {album.coverUrl ? (
            <Image
              src={album.coverUrl}
              alt={album.title}
              fill
              sizes="(max-width: 400px) 100vw, 400px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="h-full w-full bg-white/5" />
          )}
        </div>
        <div className="px-6 py-5 text-center">
          <p className="font-serif text-2xl font-semibold">{album.title}</p>
          <p className="mt-1 text-dim">
            {album.artist.name} · {album.year}
          </p>
        </div>
      </Link>

      <div className="mt-6 rounded-2xl border border-white/10 bg-surface px-5 py-6">
        <p className="font-serif text-base leading-relaxed text-foreground/95">
          {reason}
        </p>
      </div>

      {(sharedMoments.length > 0 || sharedSeeks.length > 0) && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {[...sharedMoments, ...sharedSeeks].map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-album/15 px-3 py-1 text-xs text-album-light"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <Link
        href={`/album/${album.id}`}
        className="mt-8 block rounded-2xl bg-album py-4 text-center font-semibold text-black"
      >
        Abrir el dossier juntos
      </Link>

      <Link
        href="/perfil"
        className="mt-4 block text-center text-sm text-dim underline underline-offset-4"
      >
        Gestionar dueto
      </Link>
    </main>
  );
}
