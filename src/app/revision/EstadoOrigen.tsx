"use client";

// «¿Sabe la app de dónde es este artista?» — las tres fuentes del origen, en
// una pulsación.
//
// Hermano de EstadoCurador y por el mismo motivo: cuando algo de esto falla, la
// app NO se cae —se calla y deja pasar— así que el fallo es invisible desde el
// teléfono. Lo que se ve entonces es o el aviso de "no pude confirmar que sea
// de Venezuela" saliendo siempre, o un artista de otro país colándose en un
// pedido con nombre y apellido. Aquí se pregunta a las tres delante de ti.
//
// No gasta IA: MusicBrainz, Wikidata y la Wikipedia son datos abiertos.

import { useState } from "react";
import { probarOrigen } from "./actions";

type Sonda = {
  fuente: string;
  ms: number;
  veredicto: "si" | "no" | "desconocido";
  dice: string;
};

type Resultado = {
  paises: string[];
  sondas: Sonda[];
  veredicto: "si" | "no" | "desconocido";
  origen: string | null;
  fuente: string | null;
};

const MARCA = { si: "✓", no: "✗", desconocido: "·" } as const;

export function EstadoOrigen() {
  const [artista, setArtista] = useState("");
  const [pedido, setPedido] = useState("artistas venezolanos");
  const [estado, setEstado] = useState<"idle" | "probando">("idle");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function probar() {
    if (!artista.trim()) return;
    setEstado("probando");
    setError(null);
    setResultado(null);
    try {
      setResultado(await probarOrigen(artista, pedido));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEstado("idle");
    }
  }

  return (
    <section className="mt-10">
      <div className="cabecera-seccion">
        <span className="rotulo">¿Sabe de dónde es este artista?</span>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-dim">
        Cuando alguien pide «artistas venezolanos», la app lo comprueba con datos
        duros en tres sitios, por este orden. Si las tres callan, no se descarta
        a nadie —se avisa de que no se pudo confirmar—. Prueba con un artista de
        nicho: ahí es donde se ve si las fuentes de respaldo trabajan.
      </p>

      {/* 16px de cuerpo o iOS hace zoom solo al enfocar (regla VIII.c). */}
      <label className="mt-4 block">
        <span className="rotulo">Artista</span>
        <input
          value={artista}
          onChange={(e) => setArtista(e.target.value)}
          placeholder="Sentimiento Muerto"
          className="mt-1.5 min-h-[52px] w-full border border-regla bg-transparent px-3 text-[16px]"
        />
      </label>

      <label className="mt-3 block">
        <span className="rotulo">Pedido del oyente</span>
        <input
          value={pedido}
          onChange={(e) => setPedido(e.target.value)}
          placeholder="artistas venezolanos"
          className="mt-1.5 min-h-[52px] w-full border border-regla bg-transparent px-3 text-[16px]"
        />
      </label>

      <button
        type="button"
        onClick={probar}
        disabled={estado === "probando" || !artista.trim()}
        className="sello mt-4 w-full"
        aria-busy={estado === "probando"}
      >
        {estado === "probando" ? "Preguntando a las tres…" : "Probar el origen ahora"}
      </button>

      {error && <p className="mt-3 text-xs text-red-300/90">{error}</p>}

      {resultado && (
        <div className="mt-4 border-l-2 border-album pl-3">
          {resultado.paises.length === 0 ? (
            <p className="text-sm text-dim">
              Ese pedido no nombra ningún país, así que la barrera ni se activa.
              Prueba con algo como «rock venezolano» o «artistas de Malí».
            </p>
          ) : (
            <>
              <p className="text-sm leading-relaxed">
                Pedido: <span className="dato">{resultado.paises.join(", ")}</span>.{" "}
                {resultado.veredicto === "si" && (
                  <span className="text-album-light">
                    Confirmado que es de {resultado.origen} (lo dijo {resultado.fuente}).
                  </span>
                )}
                {resultado.veredicto === "no" && (
                  <span className="text-red-300">
                    NO es de ahí: es de {resultado.origen} (lo dijo {resultado.fuente}).
                    Una propuesta así se descarta antes de fabricar nada.
                  </span>
                )}
                {resultado.veredicto === "desconocido" && (
                  <span className="text-dim">
                    Ninguna de las tres lo sabe. No se descarta —el oyente se
                    queda con el disco— pero se le avisa de que no pude
                    confirmarlo.
                  </span>
                )}
              </p>
              <ul className="mt-3 space-y-1.5">
                {resultado.sondas.map((s) => (
                  <li key={s.fuente} className="text-xs leading-relaxed">
                    <span
                      className={
                        s.veredicto === "si"
                          ? "text-album-light"
                          : s.veredicto === "no"
                            ? "text-red-300"
                            : "text-dim"
                      }
                    >
                      {MARCA[s.veredicto]} {s.fuente}
                    </span>{" "}
                    <span className="dato text-dim">· {s.ms} ms</span>
                    <span className="block text-dim/80">{s.dice}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
