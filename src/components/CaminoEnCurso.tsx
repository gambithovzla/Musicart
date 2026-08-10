// Fase 8 — la tira del camino en la home. Deliberadamente discreta: solo
// recuerda que tienes un camino a medias y enlaza a su pestaña. NO cambia ni
// compite con el disco del día; el ritual sigue siendo uno.

import Link from "next/link";

export function CaminoEnCurso({
  camino,
}: {
  camino: { id: string; titulo: string; paso: number; total: number };
}) {
  const pct = Math.round(((camino.paso - 1) / camino.total) * 100);
  return (
    <section className="mx-auto mt-10 max-w-md px-6">
      <Link
        href={`/caminos/${camino.id}`}
        className="block rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-album/40"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-dim">
              Tu camino
            </p>
            <p className="truncate text-sm font-medium">{camino.titulo}</p>
          </div>
          <span className="shrink-0 text-xs text-dim">
            Paso {camino.paso} de {camino.total}
          </span>
        </div>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-album transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </Link>
    </section>
  );
}
