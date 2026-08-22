// EL ATLAS (Fase 11) — "Conociendo a…": entrar a la música por un LUGAR.
//
// El tercer eje de Musicart. Los Caminos entran por un género, el Salón por el
// prestigio de un disco, y esto por un país: cinco discos que cuentan algo de
// él — de dónde viene su música, qué le da orgullo, con qué se mezcló, contra
// qué se levantó y qué suena hoy.

import Link from "next/link";
import { REGIONES, PAISES } from "@/lib/paises";
import { codigosConRetrato } from "@/lib/atlas";
import { IndiceDelAtlas } from "./IndiceDelAtlas";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "El atlas · Musicart",
  description:
    "Conocer un país por su música: cinco discos que cuentan de dónde viene, con qué se mezcló y qué suena hoy.",
};

export default async function AtlasPage() {
  const escritos = await codigosConRetrato();

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

      <IndiceDelAtlas regiones={REGIONES} paises={paises} />

      <div className="filete mt-12 pt-4 text-center">
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
