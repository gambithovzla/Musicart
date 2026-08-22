// EL RETRATO DE UN PAÍS (Fase 11) — "Conociendo a…".
//
// Cinco discos, cada uno con su papel: la raíz, el himno, el cruce, el grito y
// el ahora. No es un ranking ni un "top 5": es un arco que cuenta algo del país
// a quien no lo conoce.
//
// Lo que hace que esto sea un atlas y no una lista con bandera encima: de cada
// artista se ha comprobado el origen con datos duros (7.11), y lo que no se
// pudo confirmar se dice EN SU FICHA en vez de fingir seguridad.

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { paisPorCodigo } from "@/lib/paises";
import { getRetrato } from "@/lib/atlas";
import { ETIQUETA_PAPEL, SENTIDO_PAPEL } from "@/lib/atlas-tipos";
import { AbrirDiscoAtlas } from "../AbrirDiscoAtlas";
import { CreandoRetrato } from "../CreandoRetrato";
import { RehacerRetrato } from "../RehacerRetrato";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pais = paisPorCodigo(code);
  if (!pais) return { title: "El atlas · Musicart" };
  return {
    title: `Conociendo a ${pais.nombre} · Musicart`,
    description: `Cinco discos para conocer ${pais.nombre}: de dónde viene su música, con qué se mezcló y qué suena hoy.`,
  };
}

export default async function RetratoPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pais = paisPorCodigo(code);
  if (!pais) notFound();

  const [retrato, session] = await Promise.all([getRetrato(pais.code), auth()]);
  const esCurador = isAdminEmail(session?.user?.email);

  return (
    <main className="px-5 pb-24 pt-8">
      <Link
        href="/atlas"
        className="dato pulsable flex min-h-[44px] items-center text-[11px] uppercase tracking-[0.14em] text-tinta-suave"
      >
        ← El atlas
      </Link>

      <header className="mt-2">
        <p className="rotulo">Sección IV · {pais.nombre}</p>
        <h1 className="font-serif mt-3 text-[2.25rem] font-semibold leading-[0.95]">
          {retrato?.titulo ?? `Conociendo a ${pais.nombre}`}
        </h1>
        <div className="filete-grueso mt-4" />
        {retrato?.intro && (
          <p className="font-serif mt-4 text-[15px] leading-relaxed text-tinta-suave">
            {retrato.intro}
          </p>
        )}
      </header>

      {/* Todavía no existe: se escribe ahora, contando la espera. */}
      {!retrato && <CreandoRetrato code={pais.code} pais={pais.nombre} />}

      {/* Existe pero está vacío. La razón la escribe el CÓDIGO, no el LLM. */}
      {retrato?.status === "vacio" && (
        <div className="mt-8 border-y-2 border-tinta py-10 text-center">
          <p className="rotulo">Sin retrato</p>
          <p className="mx-auto mt-3 max-w-[19rem] text-[13px] leading-relaxed text-tinta-suave">
            {retrato.nota ??
              `Todavía no tengo el retrato de ${pais.nombre}.`}
          </p>
          {esCurador && (
            <div className="mt-6 flex justify-center">
              <RehacerRetrato code={pais.code} />
            </div>
          )}
        </div>
      )}

      {retrato?.status === "listo" &&
        retrato.discos.map((d) => (
          <article key={d.orden} className="mt-10">
            <div className="cabecera-seccion">
              <span className="rotulo">{ETIQUETA_PAPEL[d.papel]}</span>
              <span className="dato text-[11px] text-tinta-suave">
                № {String(d.orden).padStart(2, "0")}
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-tinta-suave">
              {SENTIDO_PAPEL[d.papel]}
            </p>

            <h2 className="font-serif mt-4 text-[24px] font-semibold leading-[1.02]">
              {d.title}
            </h2>
            <p className="mt-1.5 text-[13px] text-tinta-suave">
              {d.artist}
              {d.year ? <span className="dato ml-1.5 text-[12px]">{d.year}</span> : null}
            </p>

            {d.porque && (
              <p className="mt-3 text-[14px] leading-relaxed">{d.porque}</p>
            )}

            {/* La honestidad de la sección, disco a disco. */}
            {d.origen === "desconocido" ? (
              <p className="dato mt-3 border-l-2 border-regla pl-3 text-[11px] leading-relaxed text-tinta-suave">
                No pude confirmar con datos que {d.artist} sea de {pais.nombre}. Lo
                dejo porque el curador lo propuso para este retrato, pero prefiero
                que lo sepas.
              </p>
            ) : (
              <p className="dato mt-3 text-[11px] uppercase tracking-[0.1em] text-tinta-suave">
                Origen verificado{d.fuente ? ` · ${d.fuente}` : ""}
              </p>
            )}

            <AbrirDiscoAtlas
              code={pais.code}
              orden={d.orden}
              yaFabricado={d.albumId}
            />
          </article>
        ))}

      {retrato?.status === "listo" && esCurador && (
        <div className="filete mt-12 pt-6">
          <RehacerRetrato code={pais.code} />
        </div>
      )}
    </main>
  );
}
