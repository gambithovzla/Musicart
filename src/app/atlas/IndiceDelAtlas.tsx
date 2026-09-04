"use client";

// EL ÍNDICE DEL ATLAS — 192 países que se tocan con el pulgar.
//
// Aquí se decidió lo más importante de la sección y conviene dejarlo escrito:
// NO es un desplegable con todos los países del mundo. En un teléfono eso es un
// scroll infinito, y en la imprenta un `<select>` es justo el gesto de
// plantilla que la Fase 10 prohíbe. Es un ÍNDICE, como el de un libro: por
// regiones, con su buscador arriba, cada país en su fila de 60px con puntos
// conductores hasta la marca de si ya tiene retrato escrito.

import { useMemo, useState } from "react";
import Link from "next/link";

type PaisIndice = { code: string; nombre: string; region: string; listo: boolean };
type Region = { id: string; nombre: string; sumario: string };

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function IndiceDelAtlas({
  regiones,
  paises,
}: {
  regiones: Region[];
  paises: PaisIndice[];
}) {
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const q = normalizar(busca);
    if (!q) return paises;
    return paises.filter((p) => normalizar(p.nombre).includes(q));
  }, [busca, paises]);

  const porRegion = useMemo(() => {
    const mapa = new Map<string, PaisIndice[]>();
    for (const p of filtrados) {
      mapa.set(p.region, [...(mapa.get(p.region) ?? []), p]);
    }
    return mapa;
  }, [filtrados]);

  return (
    <>
      {/* 16px de cuerpo o iOS hace zoom solo al enfocar (regla VIII.c). */}
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Busca un país…"
        aria-label="Busca un país"
        className="mt-6 min-h-[52px] w-full border border-tinta bg-transparent px-3 text-[16px]"
      />

      {filtrados.length === 0 && (
        <p className="mt-8 text-[13px] leading-relaxed text-tinta-suave">
          No tengo ningún país con ese nombre. Prueba con otro — o mira el índice
          entero borrando la búsqueda.
        </p>
      )}

      {regiones.map((r, i) => {
        const suyos = porRegion.get(r.id) ?? [];
        if (suyos.length === 0) return null;
        return (
          <section key={r.id} className="mt-10">
            <div className="cabecera-seccion">
              <span className="rotulo">{r.nombre}</span>
              <span className="dato text-[11px] text-tinta-suave">
                № {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-tinta-suave">
              {r.sumario}
            </p>
            <ul className="mt-3 border-t border-regla">
              {suyos.map((p) => (
                <li key={p.code}>
                  <Link href={`/atlas/${p.code}`} className="fila fila-avanza">
                    <span className="dato w-7 shrink-0 text-[12px] text-tinta-suave">
                      {p.code}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px]">
                      {p.nombre}
                    </span>
                    {p.listo && (
                      <span className="dato shrink-0 text-[10px] uppercase tracking-[0.14em] text-acento">
                        escrito
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
