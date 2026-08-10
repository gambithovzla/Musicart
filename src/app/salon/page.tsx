// El Salón de la Fama (Fase 9): el veredicto de la historia, no mi gusto.
//
// Aquí el puntaje no lo escribe la IA: sale de señales duras (Wikipedia,
// premios, oyentes) y de comparar cada disco contra todo el canon. Por eso un
// 100 significa algo — y por eso se puede pedir "dame un 95" y que tenga
// sentido.
//
// La composición es la de una PORTADA con su sumario: titular a toda página,
// filete, entradilla, y debajo las secciones numeradas (№ 01, № 02…) separadas
// por reglas. Nada de tarjetas: el Salón es una institución grabada en piedra,
// no una parrilla de botones redondeados.

import Link from "next/link";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
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

/** Cabecera de sección con su folio, el gesto que ordena toda la publicación. */
function Folio({ n, titulo }: { n: number; titulo: string }) {
  return (
    <div className="cabecera-seccion">
      <span className="rotulo">{titulo}</span>
      <span className="dato text-[10px] text-tinta-suave">
        № {String(n).padStart(2, "0")}
      </span>
    </div>
  );
}

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
  // maquillarlo con datos de mentira. Al curador, además, se le dice dónde está
  // el botón que lo arregla: si no, ve lo mismo que el oyente y no puede hacer nada.
  if (muro.length === 0) {
    const sesion = await auth();
    const esCurador = isAdminEmail(sesion?.user?.email);
    return (
      <main className="px-5 pb-24 pt-8">
        <Portada />
        {/* "En prensa": la página que la revista reserva cuando una sección
            todavía no ha entrado a imprimir. */}
        <div className="mt-12 border-y-2 border-tinta py-12 text-center">
          <p className="rotulo">En prensa</p>
          <p className="font-serif mt-3 text-2xl leading-tight">
            El Salón se está levantando
          </p>
          <p className="mx-auto mt-3 max-w-[19rem] text-[13px] leading-relaxed text-tinta-suave">
            El índice del canon aún no se ha construido. Cuando esté, aquí
            estarán los discos con los que se cuenta la historia de la música.
          </p>
          {esCurador && (
            <Link href="/revision" className="sello mt-6">
              Levantarlo ahora
            </Link>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="px-5 pb-24 pt-8">
      <Portada />

      {progreso && progreso.total > 0 && (
        <section className="mt-10 border-l-2 border-album pl-3">
          <p className="rotulo">Tu recorrido</p>
          <p className="mt-2 text-[13px] leading-relaxed">
            Llevas{" "}
            <span className="cifra text-2xl font-semibold">
              {progreso.escuchados}
            </span>{" "}
            de los {progreso.total} más altos del canon
            <span className="dato ml-1.5 text-[10px] text-tinta-suave">
              ({Math.round((progreso.escuchados / progreso.total) * 100)}%)
            </span>
          </p>
          {progreso.siguientes.length > 0 && (
            <p className="mt-1.5 text-[12px] leading-relaxed text-tinta-suave">
              Te falta, por ejemplo,{" "}
              <Link
                href={`/salon/disco/${progreso.siguientes[0].id}`}
                className="text-tinta underline underline-offset-4"
              >
                {progreso.siguientes[0].title}
              </Link>{" "}
              de {progreso.siguientes[0].artist}.
            </p>
          )}
        </section>
      )}

      <section className="mt-10">
        <Folio n={1} titulo="El muro de los inmortales" />
        <p className="mt-3 text-[13px] leading-relaxed text-tinta-suave">
          Los 100 de 100. Los discos con los que se cuenta la historia de la
          música grabada — toca uno para ver por qué está aquí.
        </p>
        <div className="mt-4">
          <GaleriaCanon albums={muro} destacada />
        </div>
      </section>

      <section className="mt-12">
        <Dial />
      </section>

      <section className="mt-12">
        <Folio n={2} titulo="Los pisos del Salón" />
        <ul className="mt-4 border-t border-regla">
          {pisos.map((p) => {
            const techo = pisos.find((x) => x.min > p.min)?.min;
            return (
              <li key={p.min}>
                <Link
                  href={`/salon/lista?min=${p.min}${techo ? `&max=${techo - 1}` : ""}`}
                  className="flex items-center gap-3 border-b border-regla py-3 transition-colors hover:bg-tinta/[0.05]"
                >
                  <SelloPuntaje score={p.min === 0 ? 60 : p.min} tam="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="font-serif block text-[16px] leading-tight">
                      {p.nombre}
                    </span>
                    <span className="block text-[11px] leading-relaxed text-tinta-suave">
                      {p.descripcion}
                    </span>
                  </span>
                  <span className="dato shrink-0 text-[11px] text-tinta-suave">
                    {p.total}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {(filtros.paises.length > 0 || filtros.generos.length > 0) && (
        <section className="mt-12">
          <Folio n={3} titulo="Canon con acento" />
          <p className="mt-3 text-[13px] leading-relaxed text-tinta-suave">
            El canon global se escribe casi todo en inglés. Aquí puedes pedirle
            el suyo a cada país y a cada género.
          </p>
          {/* Sin pastillas: una lista de referencias separadas por barras, como
              los descriptores al pie de un artículo. */}
          <p className="mt-3 leading-loose">
            {filtros.generos.map((g) => (
              <Link
                key={g}
                href={`/salon/lista?genero=${encodeURIComponent(g)}`}
                className="dato mr-2 border-b border-regla text-[11px] uppercase tracking-[0.1em] transition-colors hover:border-album hover:text-album"
              >
                {g}
              </Link>
            ))}
            {filtros.paises.slice(0, 12).map((p) => (
              <Link
                key={p.code}
                href={`/salon/lista?pais=${p.code}`}
                className="dato mr-2 border-b border-regla text-[11px] uppercase tracking-[0.1em] text-tinta-suave transition-colors hover:border-album hover:text-album"
              >
                {p.nombre}
              </Link>
            ))}
          </p>
        </section>
      )}

      <div className="filete mt-12 pt-4 text-center">
        <Link
          href="/salon/lista"
          className="dato text-[11px] uppercase tracking-[0.14em] underline underline-offset-4"
        >
          Ver el canon completo
        </Link>
        <p className="mt-2 text-[11px] leading-relaxed text-tinta-suave">
          ¿Buscabas mi gusto y no el de la historia?{" "}
          <Link href="/vitrina" className="text-tinta underline underline-offset-4">
            Eso está en la vitrina
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

/** La portada de la sección: antetítulo, titular a toda página y entradilla. */
function Portada() {
  return (
    <header>
      <p className="rotulo">Sección II · El canon</p>
      <h1 className="font-serif mt-3 text-[2.75rem] font-semibold leading-[0.9]">
        El Salón
        <br />
        de la Fama
      </h1>
      <div className="filete-grueso mt-4" />
      <p className="font-serif mt-4 text-[15px] leading-relaxed text-tinta-suave">
        Aquí no opino yo: opina la historia. Cada disco lleva un puntaje del 1 al
        100 que sale de datos comprobables y de compararlo con todo el canon.
        Ábrelo y verás exactamente de dónde salió su número.
      </p>
    </header>
  );
}
