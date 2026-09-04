// EL ATLAS (Fase 11) — "Conociendo a…": entrar a la música por un LUGAR.
//
// El tercer eje de Musicart. Los Caminos entran por un género, el Salón por el
// prestigio de un disco, y esto por un país: cinco discos que cuentan algo de
// él — de dónde viene su música, qué le da orgullo, con qué se mezcló, contra
// qué se levantó y qué suena hoy.

import Link from "next/link";
import { REGIONES, PAISES, paisPorCodigo } from "@/lib/paises";
import { getListenerIdentity, findProfileRecord } from "@/lib/identity";
import { parseJson } from "@/lib/types";
import { codigosConRetrato } from "@/lib/atlas";
import { Compartir } from "@/components/Compartir";
import { IndiceDelAtlas } from "./IndiceDelAtlas";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "El atlas · Musicart",
  description:
    "Conocer un país por su música: cinco discos que cuentan de dónde viene, con qué se mezcló y qué suena hoy.",
};

/**
 * De dónde es el oyente (11.7), si lo ha dicho en su perfil. Nunca lanza: el
 * índice del Atlas se enseña igual sin saberlo — es un atajo, no la sección.
 */
async function paisDelOyente() {
  try {
    const perfil = await findProfileRecord(await getListenerIdentity());
    if (!perfil) return null;
    const answers = parseJson<Record<string, unknown>>(perfil.answersJson, {});
    const code = typeof answers.country === "string" ? answers.country : "";
    return code ? paisPorCodigo(code) : null;
  } catch {
    return null;
  }
}

export default async function AtlasPage() {
  const [escritos, tuPais] = await Promise.all([
    codigosConRetrato(),
    paisDelOyente(),
  ]);

  const paises = PAISES.map((p) => ({
    code: p.code,
    nombre: p.nombre,
    region: p.region as string,
    listo: escritos.has(p.code),
  }));

  return (
    <main className="px-5 pb-24 pt-8">
      <header>
        <p className="rotulo">Sección IV · El atlas</p>
        <h1 className="font-serif mt-3 text-[2.75rem] font-semibold leading-[0.9]">
          Conociendo
          <br />a…
        </h1>
        <div className="filete-grueso mt-4" />
        <p className="font-serif mt-4 text-[15px] leading-relaxed text-tinta-suave">
          Elige un país y te lo cuento en cinco discos. No son «los cinco
          mejores»: son los que dicen algo de él —de dónde viene su música, con
          qué se mezcló, contra qué se levantó y qué está sonando ahora—.
        </p>
        <p className="mt-3 text-[12px] leading-relaxed text-tinta-suave">
          De cada artista compruebo que sea de verdad de ahí, con datos duros y
          en tres fuentes. Cuando no puedo confirmarlo, te lo digo en su ficha en
          vez de fingir que sí.
        </p>
      </header>

      {/* Tu país primero (11.7). Es la puerta de entrada más natural a esta
          sección: casi nadie llega al atlas pensando en Mongolia, se llega
          pensando en el sitio de uno. */}
      {tuPais ? (
        <section className="mt-8">
          <div className="cabecera-seccion">
            <span className="rotulo">Tu país</span>
          </div>
          <Link
            href={`/atlas/${tuPais.code}`}
            className="recuadro pulsable mt-3 flex items-center gap-3 p-4"
          >
            <span className="min-w-0 flex-1">
              <span className="font-serif block text-[20px] leading-tight">
                {tuPais.nombre}
              </span>
              <span className="mt-1 block text-[12px] leading-snug text-tinta-suave">
                Empieza por el tuyo: es el único país del que ya sabes si te estoy
                contando la verdad.
              </span>
            </span>
            <span className="dato shrink-0 text-[18px] text-tinta-suave">›</span>
          </Link>
        </section>
      ) : (
        <p className="mt-6 text-[12px] leading-relaxed text-tinta-suave">
          Si me dices de dónde eres en{" "}
          <Link href="/perfil" className="text-tinta underline underline-offset-4">
            tu perfil
          </Link>
          , empiezo por tu país.
        </p>
      )}

      <IndiceDelAtlas regiones={REGIONES} paises={paises} />

      <div className="filete mt-12 pt-6">
        <Compartir
          ruta="/atlas"
          titulo="El atlas · Musicart"
          texto="El atlas de Musicart: eliges un país y te lo cuenta en cinco discos — de dónde viene su música, con qué se mezcló y qué suena hoy."
          etiqueta="Compartir el atlas"
        />
      </div>

      <div className="filete mt-10 pt-4 text-center">
        <p className="text-[11px] leading-relaxed text-tinta-suave">
          ¿Querías entrar por un género y no por un país?{" "}
          <Link href="/caminos" className="text-tinta underline underline-offset-4">
            Eso son los Caminos
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
