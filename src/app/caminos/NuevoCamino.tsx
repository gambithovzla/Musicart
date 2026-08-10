"use client";

// EL ÍNDICE DE GÉNEROS — antes: doce pastillas grises en una tarjeta redondeada.
//
// Aquel diseño no decía nada: doce burbujas idénticas en las que el ojo no se
// apoya en ningún sitio. Ahora es lo que de verdad es —un índice— y se compone
// como el índice de una publicación: cada género numerado, con sus puntos
// conductores llevándote hasta el número de la página. Se lee de arriba abajo,
// como una lista de contenidos, en vez de rebotar entre burbujas.
//
// Y mientras se traza, no hay ruedita girando: hay una PRENSA IMPRIMIENDO. La
// espera se cuenta con la máquina, no con un spinner de plantilla.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const GENEROS = [
  "Heavy metal",
  "Jazz",
  "Hip-hop",
  "Punk",
  "Salsa",
  "Rock progresivo",
  "Electrónica",
  "Blues",
  "Reggae",
  "Bossa nova",
  "Flamenco",
  "Soul y funk",
];

const FASES = [
  "Buscando la puerta de entrada",
  "Ordenando los discos para que cada uno prepare el siguiente",
  "Eligiendo la cima del camino",
  "Escribiendo por qué cada disco va donde va",
];

export function NuevoCamino({ primero }: { primero: boolean }) {
  const router = useRouter();
  const [tema, setTema] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<string | null>(null);
  const [fase, setFase] = useState(0);

  useEffect(() => {
    if (!cargando) return;
    const id = setInterval(() => {
      setFase((f) => (f + 1 < FASES.length ? f + 1 : f));
    }, 6000);
    return () => clearInterval(id);
  }, [cargando]);

  async function trazar(valor: string) {
    const limpio = valor.trim();
    if (!limpio || cargando) return;
    setCargando(true);
    setError(null);
    setDetalle(null);
    setFase(0);
    try {
      const res = await fetch("/api/caminos/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tema: limpio }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        caminoId?: string;
        reason?: string;
        detalle?: string;
      };
      if (data.ok && data.caminoId) {
        router.push(`/caminos/${data.caminoId}`);
        return;
      }
      // Cada fallo pide una cosa distinta: volver a darle ahora, volver luego o
      // arreglar el perfil. Decírselo evita que el oyente se quede sin salida.
      setError(
        data.reason === "tiempo"
          ? "Tardó demasiado en trazarse. Vuelve a darle: casi siempre sale a la segunda."
          : data.reason === "sin-ia" || data.reason === "ia"
          ? "Ahora mismo no puedo trazar caminos. Inténtalo en un rato."
          : data.reason === "sin-identidad"
          ? "Necesito conocerte un poco antes. Completa tu perfil y vuelve."
          : "No pude trazar este camino. Prueba otra vez o con otras palabras.",
      );
      // Solo llega si eres el curador: la app no le enseña esto a nadie más.
      if (data.detalle) setDetalle(data.detalle);
    } catch {
      setError("Se cortó la conexión. Inténtalo de nuevo.");
    }
    setCargando(false);
  }

  // ── La prensa ────────────────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="border-y-2 border-tinta py-12 text-center">
        <PrensaImprimiendo />
        <p className="rotulo mt-8">Entrando en prensa</p>
        <p className="font-serif mt-2 text-2xl leading-tight">Trazando tu camino</p>
        <p className="dato mx-auto mt-4 max-w-[17rem] text-[11px] leading-relaxed text-tinta-suave">
          {FASES[fase]}
          <span className="animate-pulse">…</span>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="cabecera-seccion">
        <span className="rotulo">
          {primero ? "Índice de géneros" : "Trazar otro camino"}
        </span>
        <span className="dato text-[10px] text-tinta-suave">
          {GENEROS.length} entradas
        </span>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-tinta-suave">
        Un género que siempre te dio curiosidad y nunca supiste por dónde entrar.
        Elige uno y te lo ordeno en cinco discos.
      </p>

      {/* El índice. Cada línea: número · género · puntos · cinco discos. */}
      <ul className="mt-5">
        {GENEROS.map((g, i) => (
          <li key={g}>
            <button
              type="button"
              onClick={() => trazar(g)}
              className="group flex w-full items-baseline gap-2.5 border-b border-regla-tenue py-2.5 text-left transition-colors hover:bg-tinta/[0.06]"
            >
              <span className="dato w-6 shrink-0 text-[10px] text-tinta-suave">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-serif shrink-0 text-[17px] leading-none transition-transform group-hover:translate-x-0.5">
                {g}
              </span>
              <span className="puntos" />
              <span className="dato shrink-0 text-[10px] uppercase tracking-[0.14em] text-tinta-suave transition-colors group-hover:text-tinta">
                5 discos
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Texto libre: una línea de máquina de escribir, no un input redondeado. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          trazar(tema);
        }}
        className="mt-8"
      >
        <label className="rotulo" htmlFor="camino-libre">
          O dímelo tú
        </label>
        <div className="mt-2 flex items-stretch gap-2">
          <input
            id="camino-libre"
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            maxLength={200}
            placeholder="«de Linkin Park a Black Sabbath»"
            className="dato min-w-0 flex-1 border-b border-tinta bg-transparent px-1 py-2 text-[13px] outline-none placeholder:text-tinta-suave/60 focus:border-album"
          />
          <button type="submit" disabled={!tema.trim()} className="sello">
            Trazar
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-5 border-l-2 border-album pl-3">
          <p className="rotulo !text-album">No se pudo</p>
          <p className="mt-1.5 text-[13px] leading-relaxed">{error}</p>
          {detalle && (
            <p className="dato mt-1.5 text-[10px] leading-relaxed text-tinta-suave">
              {detalle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * La prensa. Un rodillo entintando el papel: tres barras que barren de arriba
 * abajo bajo un marco. Es CSS puro y dice "se está imprimiendo algo" mucho
 * mejor que el circulito que gira de todas las apps.
 */
function PrensaImprimiendo() {
  return (
    <div
      aria-hidden
      className="relative mx-auto h-24 w-32 overflow-hidden border border-tinta bg-papel-alto"
    >
      {/* Las líneas del texto que va apareciendo impreso */}
      <div className="absolute inset-x-3 top-4 space-y-2">
        {[100, 82, 92, 64, 88].map((w, i) => (
          <div
            key={i}
            className="h-[3px] bg-tinta"
            style={{
              width: `${w}%`,
              opacity: 0.25,
              animation: `entintar 2.4s ${i * 0.18}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>
      {/* El rodillo */}
      <div
        className="absolute inset-x-0 h-3 bg-album"
        style={{ animation: "rodillo 2.4s infinite linear" }}
      />
      <style>{`
        @keyframes rodillo {
          0% { transform: translateY(-12px); }
          100% { transform: translateY(96px); }
        }
        @keyframes entintar {
          0%, 100% { opacity: 0.22; }
          45% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="rodillo"], [style*="entintar"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
