// Fase 8 — Caminos: por dónde entrar a un género.
// Sección aparte, a su propio ritmo. El disco del día no se toca desde aquí.

import Link from "next/link";
import { getListenerIdentity } from "@/lib/identity";
import { listarCaminos, pasoActual } from "@/lib/caminos";
import { NuevoCamino } from "./NuevoCamino";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Caminos · Musicart",
  description:
    "¿Quieres entrar a un género y no sabes por dónde empezar? Cinco discos en orden, y cada uno te deja el oído listo para el siguiente.",
};

export default async function CaminosPage() {
  const identity = await getListenerIdentity();
  const caminos = await listarCaminos(identity);

  return (
    <main className="px-6 pb-24 pt-14">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-dim">Empieza por aquí</p>
        <h1 className="font-serif mt-3 text-4xl font-semibold">Caminos</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-dim">
          A quien nunca ha leído no le das el Quijote de entrada. Pero tampoco se
          lo escondes: aquí te llevo hasta él, cinco discos en orden, y cada uno
          te deja el oído listo para el siguiente.
        </p>
      </header>

      <section className="mx-auto mt-10 max-w-md">
        <NuevoCamino primero={caminos.length === 0} />
      </section>

      {caminos.length > 0 && (
        <section className="mx-auto mt-10 max-w-md">
          <h2 className="text-xs uppercase tracking-[0.25em] text-dim">Tus caminos</h2>
          <ul className="mt-4 space-y-3">
            {caminos.map((c) => {
              const paso = pasoActual(c.pasos);
              const total = c.pasos.length;
              const completado = c.status === "completado";
              const pct = total > 0 ? Math.round(((completado ? total : paso - 1) / total) * 100) : 0;
              return (
                <li key={c.id}>
                  <Link
                    href={`/caminos/${c.id}`}
                    className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-album/40"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-serif text-lg font-semibold">{c.titulo}</p>
                      <span className="shrink-0 text-xs text-dim">
                        {completado ? "Completado" : `Paso ${paso} de ${total}`}
                      </span>
                    </div>
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-album transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
