"use client";

// Crear un camino: eliges un género (o lo escribes tú) y la IA traza los 5 pasos.
// Es una sola llamada al LLM, pero puede tardar unos segundos: mientras tanto
// mostramos la espera con alma en vez de un spinner mudo.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const SUGERENCIAS = [
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

const FRASES = [
  "Buscando la puerta de entrada…",
  "Ordenando los discos para que cada uno prepare el siguiente…",
  "Eligiendo la cima del camino…",
  "Escribiendo por qué cada disco va donde va…",
];

export function NuevoCamino({ primero }: { primero: boolean }) {
  const router = useRouter();
  const [tema, setTema] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frase, setFrase] = useState(0);

  useEffect(() => {
    if (!cargando) return;
    const id = setInterval(() => {
      setFrase((f) => (f + 1 < FRASES.length ? f + 1 : f));
    }, 6000);
    return () => clearInterval(id);
  }, [cargando]);

  async function crear(valor: string) {
    const limpio = valor.trim();
    if (!limpio || cargando) return;
    setCargando(true);
    setError(null);
    setFrase(0);
    try {
      const res = await fetch("/api/caminos/crear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tema: limpio }),
      });
      const data = (await res.json()) as { ok?: boolean; caminoId?: string; reason?: string };
      if (data.ok && data.caminoId) {
        router.push(`/caminos/${data.caminoId}`);
        return;
      }
      setError(
        data.reason === "sin-ia"
          ? "Ahora mismo no puedo trazar caminos. Inténtalo en un rato."
          : data.reason === "sin-identidad"
          ? "Necesito conocerte un poco antes. Completa tu perfil y vuelve."
          : "No pude trazar este camino. Prueba otra vez o con otras palabras.",
      );
    } catch {
      setError("Se cortó la conexión. Inténtalo de nuevo.");
    }
    setCargando(false);
  }

  if (cargando) {
    return (
      <div className="flex flex-col items-center gap-6 rounded-3xl border border-album/20 bg-album/5 px-6 py-12 text-center">
        <motion.div
          aria-hidden
          className="h-12 w-12 rounded-full border-2 border-album/30 border-t-album"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        />
        <div>
          <p className="font-serif text-lg font-semibold">Trazando tu camino</p>
          <div className="mt-2 h-10">
            <AnimatePresence mode="wait">
              <motion.p
                key={frase}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.4 }}
                className="text-sm text-dim"
              >
                {FRASES[frase]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-sm font-medium">
        {primero ? "¿Qué te gustaría entender?" : "Empezar otro camino"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-dim">
        Un género que siempre te dio curiosidad y nunca supiste por dónde entrar.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGERENCIAS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => crear(s)}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-dim transition-colors hover:border-album/50 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          crear(tema);
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          maxLength={200}
          placeholder="O escríbelo tú: «de Linkin Park a Black Sabbath»"
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-dim/60 focus:border-album/60"
        />
        <button
          type="submit"
          disabled={!tema.trim()}
          className="shrink-0 rounded-xl bg-album px-4 py-2 text-sm font-medium text-black transition-opacity disabled:opacity-40"
        >
          Trazar
        </button>
      </form>

      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
    </div>
  );
}
