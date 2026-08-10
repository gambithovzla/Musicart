// El Salón de la Fama (Fase 9): el veredicto de la historia, no mi gusto.
//
// Aquí el puntaje no lo escribe la IA: sale de señales duras (Wikipedia,
// premios, oyentes) y de comparar cada disco contra todo el canon. Por eso un
// 100 significa algo — y por eso se puede pedir "dame un 95" y que tenga
// sentido.

import Link from "next/link";
import { getListenerIdentity, hasListener } from "@/lib/identity";
import {
  getMuro,
  contarPorPiso,
  progresoDelOyente,
  filtrosDisponibles,
} from "@/lib/canon/consulta";
import { Dial } from "./Dial";
import { GaleriaCanon } from "./GaleriaCanon";
import { SelloPuntaje } from "./SelloPuntaje";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "El Salón de la Fama · Musicart",
  description:
    "Los discos que la historia consagró, con un puntaje comparable de 1 a 100 y los datos que lo respaldan.",
};

export default async function SalonPage() {
  const identity = await getListenerIdentity();
  const [muro, pisos, filtros] = await Promise.all([
    getMuro(12),
    contarPorPiso(),
    filtrosDisponibles(),
  ]);
  const progreso = hasListener(identity)
    ? await progresoDelOyente(identity)
    : null;

  // Índice vacío: la ingesta todavía no ha corrido. Se dice claro, sin
  // maquillarlo con datos de mentira.
  if (muro.length === 0) {
    return (
      <main className="px-6 pb-16 pt-14">
        <Cabecera />
        <div className="mt-10 rounded-3xl border border-white/10 bg-surface p-10 text-center">
          <p className="text-4xl">🏛</p>
          <p className="font-serif mt-4 text-lg">El Salón se está levantando</p>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-dim">
            El índice del canon aún no se ha construido. Cuando esté, aquí
            estarán los discos con los que se cuenta la historia de la música.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="px-6 pb-16 pt-14">
      <Cabecera />

      {progreso && progreso.total > 0 && (
        <section className="mt-8 rounded-2xl border border-album/20 bg-album/5 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm">
              Llevas{" "}
              <strong className="font-serif text-lg text-album-light">
                {progreso.escuchados}
              </strong>{" "}
              de los {progreso.total} más altos del canon
            </p>
            <span className="text-xs text-dim">
              {Math.round((progreso.escuchados / progreso.total) * 100)}%
            </span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-album transition-all"
              style={{
                width: `${Math.max(2, (progreso.escuchados / progreso.total) * 100)}%`,
              }}
            />
          </div>
          {progreso.siguientes.length > 0 && (
            <p className="mt-3 text-xs leading-relaxed text-dim">
              Te falta, por ejemplo,{" "}
              <Link
                href={`/salon/disco/${progreso.siguientes[0].id}`}
                className="text-foreground underline underline-offset-4"
              >
                {progreso.siguientes[0].title}
              </Link>{" "}
              de {progreso.siguientes[0].artist}.
            </p>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-serif text-xl font-semibold">El muro de los inmortales</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-dim">
          Los 100 de 100. Los discos con los que se cuenta la historia de la
          música grabada — toca uno para ver por qué está aquí.
        </p>
        <div className="mt-5">
          <GaleriaCanon albums={muro} destacada />
        </div>
      </section>

      <div className="mt-10">
        <Dial />
      </div>

      <section className="mt-10">
        <h2 className="font-serif text-xl font-semibold">Los pisos del Salón</h2>
        <ul className="mt-4 space-y-2.5">
          {pisos.map((p) => {
            const techo = pisos.find((x) => x.min > p.min)?.min;
            return (
              <li key={p.min}>
                <Link
                  href={`/salon/lista?min=${p.min}${techo ? `&max=${techo - 1}` : ""}`}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-surface p-4 transition-colors hover:border-album/40"
                >
                  <SelloPuntaje score={p.min === 0 ? 60 : p.min} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{p.nombre}</span>
                    <span className="block text-xs leading-relaxed text-dim">
                      {p.descripcion}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-dim">
                    {p.total}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {(filtros.paises.length > 0 || filtros.generos.length > 0) && (
        <section className="mt-10">
          <h2 className="font-serif text-xl font-semibold">Canon con acento</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-dim">
            El canon global se escribe casi todo en inglés. Aquí puedes pedirle
            el suyo a cada país y a cada género.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {filtros.generos.map((g) => (
              <Link
                key={g}
                href={`/salon/lista?genero=${encodeURIComponent(g)}`}
                className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-foreground/80 transition-colors hover:border-album/50"
              >
                {g}
              </Link>
            ))}
            {filtros.paises.slice(0, 12).map((p) => (
              <Link
                key={p.code}
                href={`/salon/lista?pais=${p.code}`}
                className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-foreground/80 transition-colors hover:border-album/50"
              >
                {p.nombre}
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-center text-xs leading-relaxed text-dim">
        <Link href="/salon/lista" className="underline underline-offset-4">
          Ver el canon completo
        </Link>
        {" · "}
        <Link href="/vitrina" className="underline underline-offset-4">
          ¿Buscabas mi gusto? Eso está en la vitrina
        </Link>
      </p>
    </main>
  );
}

function Cabecera() {
  return (
    <header className="text-center">
      <p className="text-xs uppercase tracking-[0.35em] text-dim">El canon</p>
      <h1 className="font-serif mt-3 text-4xl font-semibold">El Salón de la Fama</h1>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-dim">
        Aquí no opino yo: opina la historia. Cada disco lleva un puntaje del 1 al
        100 que sale de datos comprobables y de compararlo con todo el canon.
        Ábrelo y verás exactamente de dónde salió su número.
      </p>
    </header>
  );
}
