// Fase 8 — Caminos: por dónde entrar a un género.
// Sección aparte, a su propio ritmo. El disco del día no se toca desde aquí.
//
// Compuesta como una sección de revista: antetítulo, titular grande, entradilla
// a un ancho de lectura, y los caminos en curso listados como ITINERARIOS —con
// sus cinco estaciones marcadas— en vez de tarjetas con barrita de progreso.

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
    <main className="px-5 pb-24 pt-8">
      <header>
        <p className="rotulo">Sección II · Caminos</p>
        <h1 className="font-serif mt-3 text-[2.75rem] font-semibold leading-[0.92]">
          Por dónde
          <br />
          se entra
        </h1>
        <div className="filete-grueso mt-4" />
        {/* Entradilla: en una revista va más grande que el cuerpo y sin sangrar. */}
        <p className="font-serif mt-4 text-[15px] leading-relaxed text-tinta-suave">
          A quien nunca ha leído no le das el Quijote de entrada. Pero tampoco se
          lo escondes: aquí te llevo hasta él, cinco discos en orden, y cada uno
          te deja el oído listo para el siguiente.
        </p>
      </header>

      {caminos.length > 0 && (
        <section className="mt-10">
          <div className="cabecera-seccion">
            <span className="rotulo">Tus caminos</span>
            <span className="dato text-[10px] text-tinta-suave">
              {caminos.length} en curso
            </span>
          </div>

          <ul>
            {caminos.map((c) => {
              const paso = pasoActual(c.pasos);
              const total = c.pasos.length;
              const completado = c.status === "completado";
              const hechos = completado ? total : paso - 1;
              return (
                <li key={c.id}>
                  <Link
                    href={`/caminos/${c.id}`}
                    className="block border-b border-regla py-4 transition-colors hover:bg-tinta/[0.05]"
                  >
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-serif min-w-0 flex-1 truncate text-xl">
                        {c.titulo}
                      </span>
                      <span className="dato shrink-0 text-[10px] uppercase tracking-[0.14em] text-tinta-suave">
                        {completado ? "Completado" : `${paso} de ${total}`}
                      </span>
                    </div>

                    {/* El itinerario: cinco estaciones cosidas por una línea.
                        Las andadas van entintadas; la de ahora, hueca y marcada;
                        las que faltan, apenas insinuadas. */}
                    <div className="mt-3 flex items-center">
                      {c.pasos.map((p, i) => {
                        const andado = i < hechos;
                        const actual = !completado && i === hechos;
                        return (
                          <div key={p.orden} className="flex flex-1 items-center last:flex-none">
                            <span
                              className={`h-2.5 w-2.5 shrink-0 border ${
                                andado
                                  ? "border-tinta bg-tinta"
                                  : actual
                                    ? "border-album bg-album/30"
                                    : "border-regla"
                              }`}
                            />
                            {i < c.pasos.length - 1 && (
                              <span
                                className={`h-px flex-1 ${
                                  andado ? "bg-tinta" : "bg-regla"
                                }`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <NuevoCamino primero={caminos.length === 0} />
      </section>
    </main>
  );
}
