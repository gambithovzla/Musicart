// Un camino: sus 5 discos en orden, con el papel de cada uno y el puente que
// explica por qué va ahí. Los pasos futuros se ven desde el principio a
// propósito — el camino no esconde su cima, te dice a dónde vas.

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getListenerIdentity } from "@/lib/identity";
import { getCamino, pasoAbierto, pasoActual } from "@/lib/caminos";
import { PasoCard, type PasoAlbum } from "./PasoCard";
import { BorrarCamino } from "./BorrarCamino";

export const dynamic = "force-dynamic";

export default async function CaminoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const identity = await getListenerIdentity();
  const camino = await getCamino(id, identity);
  if (!camino) notFound();

  // Portadas de los pasos ya fabricados (una sola consulta).
  const albumIds = camino.pasos
    .map((p) => p.albumId)
    .filter((x): x is string => Boolean(x));
  const albums = albumIds.length
    ? await prisma.album.findMany({
        where: { id: { in: albumIds } },
        select: { id: true, coverUrl: true },
      })
    : [];
  const porId = new Map<string, PasoAlbum>(albums.map((a) => [a.id, a]));

  const total = camino.pasos.length;
  const paso = pasoActual(camino.pasos);
  const completado = camino.status === "completado";

  return (
    <main className="px-6 pb-24 pt-14">
      <Link
        href="/caminos"
        className="text-xs text-dim transition-colors hover:text-foreground"
      >
        ← Todos los caminos
      </Link>

      <header className="mt-6">
        <p className="text-xs uppercase tracking-[0.3em] text-dim">
          {completado ? "Camino completado" : `Paso ${paso} de ${total}`}
        </p>
        <h1 className="font-serif mt-3 text-3xl font-semibold leading-tight">
          {camino.titulo}
        </h1>
        {camino.intro && (
          <p className="mt-4 text-sm leading-relaxed text-dim">{camino.intro}</p>
        )}
      </header>

      {completado && (
        <div className="mt-8 rounded-2xl border border-album/30 bg-album/5 p-5 text-center">
          <p className="font-serif text-lg font-semibold">Lo terminaste.</p>
          <p className="mt-2 text-sm leading-relaxed text-dim">
            Ya no entras de fuera a este género: ahora lo oyes desde dentro.
            Cuando quieras, abrimos otro camino.
          </p>
        </div>
      )}

      <ol className="mx-auto mt-8 max-w-md space-y-4">
        {camino.pasos.map((p, i) => (
          <PasoCard
            key={p.orden}
            caminoId={camino.id}
            paso={p}
            abierto={pasoAbierto(camino.pasos, i)}
            album={p.albumId ? porId.get(p.albumId) ?? null : null}
          />
        ))}
      </ol>

      <div className="mx-auto mt-10 max-w-md text-center">
        <BorrarCamino caminoId={camino.id} />
      </div>
    </main>
  );
}
