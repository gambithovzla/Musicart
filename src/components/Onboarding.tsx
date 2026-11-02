"use client";

// La entrada a Musicart (Fase 6): antes de ver ningún disco, conocemos a la
// persona en pocos pasos bonitos. Al terminar, guardamos su perfil y la home
// fabrica su PRIMER disco a medida. Sin perfil no se muestra ningún disco.
//
// Compuesta en la imprenta (nov 2026), con dos arreglos que pidió el dueño:
//   · "Empezar" quedaba DEBAJO de la barra de pestañas en un teléfono normal
//     (390×844): la pantalla medía 100dvh y no descontaba la cabecera ni el pie.
//     Ahora la barra de acciones va pegada justo encima de las pestañas, siempre
//     visible, mida lo que mida la pantalla.
//   · "Le falta vida": la bienvenida era una frase sobre negro. Ahora la abre un
//     MURO de portadas reales del catálogo que sube despacio, como una rotativa.
// Y fuera los gestos de plantilla que quedaban aquí: pastillas, halos dorados y
// campos de 14px (iOS hace zoom solo por debajo de 16px, regla VIII.c).

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { saveProfile } from "@/app/actions";
import { getDeviceId, LANG_COOKIE } from "@/lib/device";

const GENRES = [
  "Rock", "Pop", "Jazz", "Salsa", "Hip-hop", "Electrónica", "Indie", "Metal",
  "Clásica", "Folk", "R&B / Soul", "Reggae", "Punk", "Blues", "Cumbia",
  "Bolero", "Funk", "Reguetón", "Trap", "Bossa nova",
];
const LANGUAGES = ["Español", "English", "Italiano", "Français", "Português"];
const SEEKS = ["La historia", "La emoción", "La técnica", "Descubrir lo nuevo"];

type ArtistSuggestion = { name: string; image: string | null };

type Answers = {
  genres: string[];
  artists: string[];
  artistImages: Record<string, string>;
  languages: string[];
  seeks: string[];
  markedAlbum: string;
  markedArtist: string;
  favoriteSong: string;
  favoriteSongArtist: string;
};

const EMPTY: Answers = {
  genres: [], artists: [], artistImages: {}, languages: [], seeks: [],
  markedAlbum: "", markedArtist: "", favoriteSong: "", favoriteSongArtist: "",
};

const STORAGE_KEY = "musicart:profile";

export type PortadaMuro = { url: string; title: string };

export function Onboarding({
  dateKey,
  nombre,
  portadas = [],
}: {
  dateKey: string; // para fijar el idioma de hoy y no doble-preguntar
  nombre?: string | null;
  portadas?: PortadaMuro[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>(EMPTY);
  const [saving, setSaving] = useState(false);

  function update(patch: Partial<Answers>) {
    setA((prev) => ({ ...prev, ...patch }));
  }
  function toggle(list: "genres" | "languages" | "seeks", value: string) {
    setA((prev) => ({
      ...prev,
      [list]: prev[list].includes(value)
        ? prev[list].filter((v) => v !== value)
        : [...prev[list], value],
    }));
  }

  const tieneSeñal = a.genres.length > 0 || a.artists.length > 0;

  // Los pasos del viaje (el 0 es bienvenida).
  const pasos: { key: string; render: () => React.ReactNode }[] = [
    {
      key: "welcome",
      render: () => (
        <div>
          <MuroDePortadas portadas={portadas} />
          <p className="rotulo mt-6">Bienvenido a Musicart</p>
          <h1 className="font-serif mt-3 text-[2.5rem] font-semibold leading-[0.98]">
            {nombre ? `Hola, ${nombre.split(" ")[0]}.` : "Un disco al día,"}
            <br />
            <span className="text-acento">hecho para ti.</span>
          </h1>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-tinta-suave">
            Cada mañana, un disco entero con su historia: quién lo hizo, qué estaba
            en juego y qué oír. Antes del primero, cuéntame quién eres — son seis
            preguntas cortas.
          </p>
        </div>
      ),
    },
    {
      key: "genres",
      render: () => (
        <Pregunta n={1} titulo="¿Qué géneros te mueven?" ayuda="Elige los que quieras.">
          <Casillas opciones={GENRES} activas={a.genres} alternar={(g) => toggle("genres", g)} />
        </Pregunta>
      ),
    },
    {
      key: "artists",
      render: () => (
        <Pregunta
          n={2}
          titulo="¿Qué artistas amas?"
          ayuda="Escribe y elígelos de la lista. Cuantos más, mejor te conozco."
        >
          <ArtistPicker answers={a} update={update} />
        </Pregunta>
      ),
    },
    {
      key: "marked",
      render: () => (
        <Pregunta n={3} titulo="¿Un disco que te marcó?" ayuda="Ese que recuerdas con cariño (opcional).">
          <div className="flex w-full flex-col gap-3">
            <Texto valor={a.markedAlbum} set={(v) => update({ markedAlbum: v })} placeholder="Nombre del disco" />
            <Texto valor={a.markedArtist} set={(v) => update({ markedArtist: v })} placeholder="¿De qué artista?" />
          </div>
        </Pregunta>
      ),
    },
    {
      key: "song",
      render: () => (
        <Pregunta n={4} titulo="¿Tu canción favorita?" ayuda="La que nunca te cansa (opcional).">
          <div className="flex w-full flex-col gap-3">
            <Texto valor={a.favoriteSong} set={(v) => update({ favoriteSong: v })} placeholder="Nombre de la canción" />
            <Texto valor={a.favoriteSongArtist} set={(v) => update({ favoriteSongArtist: v })} placeholder="¿De qué artista?" />
          </div>
        </Pregunta>
      ),
    },
    {
      key: "languages",
      render: () => (
        <Pregunta n={5} titulo="¿En qué idiomas disfrutas la música?" ayuda="Te recomendaré donde te sientas cómodo/a.">
          <Casillas opciones={LANGUAGES} activas={a.languages} alternar={(l) => toggle("languages", l)} />
        </Pregunta>
      ),
    },
    {
      key: "seeks",
      render: () => (
        <Pregunta n={6} titulo="¿Qué buscas en un disco?" ayuda="Lo que más te importa al escuchar.">
          <Casillas opciones={SEEKS} activas={a.seeks} alternar={(s) => toggle("seeks", s)} />
        </Pregunta>
      ),
    },
  ];

  const total = pasos.length;
  const esUltimo = step === total - 1;
  const esBienvenida = step === 0;

  async function finalizar() {
    if (saving) return;
    setSaving(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
    } catch {
      // localStorage no disponible: no pasa nada, igual guardamos en el servidor
    }
    try {
      await saveProfile(getDeviceId(), a);
      // Fijamos el idioma de hoy a "Cualquiera" para no volver a preguntar justo
      // después; el primer disco lo guían sus géneros y artistas.
      document.cookie = `${LANG_COOKIE}=${dateKey}|${encodeURIComponent("Cualquiera")}; path=/; max-age=86400; samesite=lax`;
      router.refresh();
    } catch {
      setSaving(false);
    }
  }

  return (
    <main data-onboarding className="flex min-h-[calc(100dvh-8.5rem)] flex-col px-5 pt-5">
      {/* Progreso: seis segmentos rectos y el folio del paso. */}
      {!esBienvenida && (
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1" aria-hidden>
            {pasos.slice(1).map((p, i) => (
              <span
                key={p.key}
                className={`h-[3px] flex-1 transition-colors duration-300 ${
                  i < step ? "bg-acento" : "bg-regla"
                }`}
              />
            ))}
          </div>
          <span className="dato shrink-0 text-[11px] text-tinta-suave">
            {String(step).padStart(2, "0")} / {String(total - 1).padStart(2, "0")}
          </span>
        </div>
      )}

      <div className={`flex flex-1 ${esBienvenida ? "items-start" : "items-center"} pb-6`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={pasos[step].key}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            {pasos[step].render()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navegación: pegada JUSTO encima de la barra de pestañas (≈65px +
          zona segura), para que nunca quede tapada. */}
      <div className="sticky bottom-[calc(65px+env(safe-area-inset-bottom))] z-10 -mx-5 border-t border-regla bg-papel px-5 py-3">
        {esUltimo && !tieneSeñal && (
          <p className="mb-2 text-[13px] text-tinta-suave">
            Elige al menos un género o un artista para que tu primer disco sea tuyo.
          </p>
        )}
        <div className="flex items-stretch gap-3">
          {!esBienvenida && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={saving}
              className="sello-hueco px-4"
            >
              Atrás
            </button>
          )}
          {esUltimo ? (
            <button
              type="button"
              onClick={finalizar}
              disabled={saving || !tieneSeñal}
              aria-busy={saving}
              className="sello flex-1"
            >
              {saving ? "Creando tu primer disco…" : "Crear mi primer disco"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
              className="sello sello-reparte flex-1"
            >
              <span>{esBienvenida ? "Empezar" : "Siguiente"}</span>
              <span aria-hidden>›</span>
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

// ─── Piezas ──────────────────────────────────────────────────────────────────

/**
 * El muro: tres columnas de portadas reales que suben despacio y en bucle (la
 * lista va dos veces para que el corte no se vea). Con "reducir movimiento",
 * quieto. Sin portadas, no ocupa sitio.
 */
function MuroDePortadas({ portadas }: { portadas: PortadaMuro[] }) {
  const reducir = useReducedMotion();
  if (portadas.length < 3) return null;
  // Con pocas portadas (un catálogo recién nacido) se repiten hasta llenar el
  // muro; desfasadas por columna, la repetición casi no se nota.
  // Cada vuelta va rotada una posición: si no, con tres portadas cada columna
  // repetía la misma de arriba abajo.
  const lista: PortadaMuro[] = [];
  for (let vuelta = 0; lista.length < 12; vuelta++) {
    const r = vuelta % portadas.length;
    lista.push(...portadas.slice(r), ...portadas.slice(0, r));
  }
  const columnas: PortadaMuro[][] = [[], [], []];
  lista.slice(0, 24).forEach((p, i) => columnas[i % 3].push(p));
  return (
    <div
      aria-hidden
      className="relative -mx-5 h-[38dvh] min-h-[220px] overflow-hidden border-y border-tinta"
      style={{
        maskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 78%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 78%, transparent 100%)",
      }}
    >
      <div className="grid grid-cols-3 gap-[3px] px-[3px]">
        {columnas.map((col, c) => (
          <div
            key={c}
            className={reducir ? "" : "muro-sube"}
            // Cada columna a su ritmo y desfasada: si suben igual, parece una
            // imagen moviéndose; desfasadas, parece una rotativa.
            style={{ animationDuration: `${52 + c * 14}s`, animationDelay: `${-c * 9}s` }}
          >
            {[...col, ...col].map((p, i) => (
              <div key={i} className="trama relative mb-[3px] aspect-square w-full bg-papel-alto">
                <Image src={p.url} alt="" fill sizes="140px" className="object-cover" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Pregunta({
  n,
  titulo,
  ayuda,
  children,
}: {
  n: number;
  titulo: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="dato text-[12px] text-acento">№ {String(n).padStart(2, "0")}</p>
      <h2 className="font-serif mt-2 text-[2rem] font-semibold leading-[1.02]">{titulo}</h2>
      {ayuda && <p className="mt-2 text-[15px] text-tinta-suave">{ayuda}</p>}
      <div className="mt-6 w-full">{children}</div>
    </div>
  );
}

function Texto({
  valor,
  set,
  placeholder,
}: {
  valor: string;
  set: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={valor}
      onChange={(e) => set(e.target.value.slice(0, 80))}
      placeholder={placeholder}
      // 16px: por debajo, iOS hace zoom al enfocar (regla VIII.c).
      className="min-h-[52px] w-full border border-tinta bg-papel-alto px-4 text-base transition-colors placeholder:text-tinta-suave/70 focus:border-acento focus:outline-none"
    />
  );
}

/** Casillas de opción: rectángulos de 48px que se entintan al marcarse. */
function Casillas({
  opciones,
  activas,
  alternar,
}: {
  opciones: string[];
  activas: string[];
  alternar: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map((o) => {
        const activa = activas.includes(o);
        return (
          <motion.button
            key={o}
            type="button"
            onClick={() => alternar(o)}
            whileTap={{ scale: 0.95 }}
            aria-pressed={activa}
            className={`min-h-[48px] border px-4 text-[15px] font-medium transition-colors duration-150 ${
              activa
                ? "border-tinta bg-acento text-papel-hondo shadow-[3px_3px_0_0_var(--tinta)]"
                : "border-regla bg-papel-alto text-tinta active:bg-tinta/10"
            }`}
          >
            {activa && <span className="dato mr-1.5">✓</span>}
            {o}
          </motion.button>
        );
      })}
    </div>
  );
}

// Autocompletado de artistas con foto (Deezer vía /api/artists).
function ArtistPicker({
  answers,
  update,
}: {
  answers: Answers;
  update: (patch: Partial<Answers>) => void;
}) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<ArtistSuggestion[]>([]);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = input.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const c = new AbortController();
    ctrl.current = c;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/artists?q=${encodeURIComponent(q)}`, { signal: c.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { results?: ArtistSuggestion[] };
        setSuggestions(Array.isArray(data.results) ? data.results : []);
      } catch {
        // sin red: el usuario igual puede escribir y pulsar Enter
      }
    }, 250);
    return () => {
      c.abort();
      clearTimeout(t);
    };
  }, [input]);

  function add(name: string, image?: string | null) {
    const value = name.trim();
    if (!value) return;
    if (answers.artists.some((x) => x.toLowerCase() === value.toLowerCase())) {
      setInput("");
      setSuggestions([]);
      return;
    }
    update({
      artists: [...answers.artists, value],
      artistImages: image ? { ...answers.artistImages, [value]: image } : answers.artistImages,
    });
    setInput("");
    setSuggestions([]);
  }

  function remove(name: string) {
    const images = { ...answers.artistImages };
    delete images[name];
    update({ artists: answers.artists.filter((x) => x !== name), artistImages: images });
  }

  const visibles = suggestions.filter(
    (s) => !answers.artists.some((x) => x.toLowerCase() === s.name.toLowerCase()),
  );

  return (
    <div className="w-full">
      {answers.artists.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {answers.artists.map((name) => (
            <motion.span
              key={name}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex min-h-[44px] items-center gap-2 border border-tinta bg-acento py-1 pl-1 pr-1 text-[15px] font-medium text-papel-hondo"
            >
              {answers.artistImages[name] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={answers.artistImages[name]} alt="" className="circulo h-8 w-8 object-cover" />
              ) : (
                <span className="circulo flex h-8 w-8 items-center justify-center bg-papel-hondo/20 text-xs">♪</span>
              )}
              {name}
              <button
                type="button"
                onClick={() => remove(name)}
                aria-label={`Quitar ${name}`}
                className="flex h-9 w-9 items-center justify-center text-papel-hondo/70 active:bg-papel-hondo/20"
              >
                ✕
              </button>
            </motion.span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              if (visibles[0]) add(visibles[0].name, visibles[0].image);
              else add(input);
            } else if (e.key === "Backspace" && !input && answers.artists.length) {
              remove(answers.artists[answers.artists.length - 1]);
            }
          }}
          placeholder={answers.artists.length ? "Añadir otro…" : "Ej.: Soda Stereo, Radiohead…"}
          className="min-h-[52px] w-full border border-tinta bg-papel-alto px-4 text-base transition-colors placeholder:text-tinta-suave/70 focus:border-acento focus:outline-none"
        />
        <AnimatePresence>
          {visibles.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="recuadro absolute z-20 mt-2 max-h-64 w-full overflow-auto text-left"
            >
              {visibles.map((s) => (
                <li key={s.name}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      add(s.name, s.image);
                    }}
                    className="fila px-3"
                  >
                    {s.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image} alt="" className="circulo h-10 w-10 shrink-0 object-cover" />
                    ) : (
                      <span className="circulo flex h-10 w-10 shrink-0 items-center justify-center bg-papel-hondo text-base">♪</span>
                    )}
                    <span className="truncate text-[15px] font-medium">{s.name}</span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
