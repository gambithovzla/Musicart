// Panel de revisión (Fase 2.3): drafts que no pasaron la verificación
// automática + estado de la cola de generación. Solo para el dueño:
//   /revision?clave=ADMIN_SECRET

import Link from "next/link";
import { prisma } from "@/lib/db";
import { publishDossier, discardDossier } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Revisión · Musicart" };

export default async function RevisionPage({
  searchParams,
}: {
  searchParams: Promise<{ clave?: string }>;
}) {
  const { clave } = await searchParams;
  const secret = process.env.ADMIN_SECRET;

  if (!secret || clave !== secret) {
    return (
      <main className="flex min-h-[80dvh] flex-col items-center justify-center gap-3 px-8 text-center">
        <h1 className="font-serif text-2xl">Revisión</h1>
        <p className="text-sm text-dim">
          {secret
            ? "Acceso restringido. Entra con /revision?clave=…"
            : "Configura la variable ADMIN_SECRET (en Vercel) para usar este panel."}
        </p>
      </main>
    );
  }

  const [drafts, cola] = await Promise.all([
    prisma.dossier.findMany({
      where: { status: "draft", locale: "es" },
      include: { album: { include: { artist: true } } },
      orderBy: { id: "desc" },
    }),
    prisma.generationQueue.findMany({
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <main className="px-6 pb-16 pt-12">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-dim">Solo para ti</p>
        <h1 className="font-serif mt-2 text-3xl font-semibold">Revisión</h1>
      </header>

      {/* — Drafts esperando ojo humano — */}
      <section className="mt-10">
        <h2 className="font-serif text-xl">
          Drafts pendientes{" "}
          <span className="text-base text-dim">({drafts.length})</span>
        </h2>
        <p className="mt-1 text-sm text-dim">
          No pasaron la verificación automática. Léelos y decide.
        </p>
        {drafts.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-surface p-5 text-sm text-dim">
            Nada pendiente — todo lo generado pasó la verificación. ✓
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            {drafts.map((d) => (
              <div
                key={d.id}
                className="rounded-2xl border border-white/10 bg-surface p-5"
              >
                <p className="font-medium">
                  {d.album.title}{" "}
                  <span className="font-normal text-dim">
                    · {d.album.artist.name} · {d.album.year}
                  </span>
                </p>
                <p className="font-serif mt-2 line-clamp-3 text-sm italic leading-relaxed text-foreground/80">
                  {d.intro}
                </p>
                <div className="mt-4 flex items-center gap-3 text-sm">
                  <Link
                    href={`/album/${d.albumId}`}
                    className="rounded-full border border-white/15 px-4 py-2 text-foreground/80"
                  >
                    Leer completo
                  </Link>
                  <form action={publishDossier.bind(null, d.id, clave!)}>
                    <button className="rounded-full bg-album px-4 py-2 font-semibold text-black">
                      Publicar
                    </button>
                  </form>
                  <form action={discardDossier.bind(null, d.id, clave!)}>
                    <button className="rounded-full border border-red-400/40 px-4 py-2 text-red-300">
                      Descartar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* — La cola de generación, tal cual la dejó el worker — */}
      <section className="mt-12">
        <h2 className="font-serif text-xl">
          Cola de generación{" "}
          <span className="text-base text-dim">(últimos {cola.length})</span>
        </h2>
        {cola.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-surface p-5 text-sm text-dim">
            La cola está vacía. El worker la llenará en su próxima corrida (o
            corre <code>npm run worker</code>).
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-2">
            {cola.map((q) => (
              <li
                key={q.id}
                className="rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate">
                    “{q.title}” · {q.artist}
                  </span>
                  <EstadoBadge status={q.status} result={q.result} />
                </div>
                {q.reason && (
                  <p className="mt-1 text-xs italic text-dim">{q.reason}</p>
                )}
                {q.error && (
                  <p className="mt-1 break-words text-xs text-red-300/90">
                    {q.error}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function EstadoBadge({ status, result }: { status: string; result: string | null }) {
  const etiqueta =
    status === "done"
      ? result === "published"
        ? "✓ publicado"
        : "◦ draft"
      : status === "failed"
        ? "✗ falló"
        : status === "running"
          ? "… generando"
          : "pendiente";
  const color =
    status === "done" && result === "published"
      ? "text-album-light"
      : status === "failed"
        ? "text-red-300"
        : "text-dim";
  return <span className={`shrink-0 text-xs ${color}`}>{etiqueta}</span>;
}
