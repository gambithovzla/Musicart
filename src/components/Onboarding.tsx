"use client";

// La entrada a Musicart (Fase 6): antes de ver ningún disco, conocemos a la
// persona en pocos pasos bonitos. Al terminar, guardamos su perfil y la home
// fabrica su PRIMER disco a medida. Sin perfil no se muestra ningún disco.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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

export function Onboarding({
  dateKey,
  nombre,
}: {
  dateKey: string; // para fijar el idioma de hoy y no doble-preguntar
  nombre?: string | null;
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
        <Centro>
          <p className="text-xs uppercase tracking-[0.3em] text-dim">Bienvenido a Musicart</p>
          <h1 className="font-serif mt-4 text-3xl leading-tight">
            {nombre ? `Hola, ${nombre.split(" ")[0]}.` : "Un disco al día,"}
            <br />
            hecho para ti.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-dim">
            Antes de tu primer disco, cuéntame quién eres. Son 6 preguntas
            cortas — así el disco de hoy ya será tuyo, no uno cualquiera.
          </p>
        </Centro>
      ),
    },
    {
      key: "genres",
      render: () => (
        <Pregunta titulo="¿Qué géneros te mueven?" ayuda="Elige los que quieras.">
          <div className="flex flex-wrap justify-center gap-2">
            {GENRES.map((g) => (
              <Chip key={g} label={g} active={a.genres.includes(g)} onClick={() => toggle("genres", g)} />
            ))}
          </div>
        </Pregunta>
      ),
    },
    {
      key: "artists",
      render: () => (
        <Pregunta
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
        <Pregunta titulo="¿Un disco que te marcó?" ayuda="Ese que recuerdas con cariño (opcional).">
          <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
            <Texto valor={a.markedAlbum} set={(v) => update({ markedAlbum: v })} placeholder="Nombre del disco" />
            <Texto valor={a.markedArtist} set={(v) => update({ markedArtist: v })} placeholder="¿De qué artista?" />
          </div>
        </Pregunta>
      ),
    },
    {
      key: "song",
      render: () => (
        <Pregunta titulo="¿Tu canción favorita?" ayuda="La que nunca te cansa (opcional).">
          <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
            <Texto valor={a.favoriteSong} set={(v) => update({ favoriteSong: v })} placeholder="Nombre de la canción" />
            <Texto valor={a.favoriteSongArtist} set={(v) => update({ favoriteSongArtist: v })} placeholder="¿De qué artista?" />
          </div>
        </Pregunta>
      ),
    },
    {
      key: "languages",
      render: () => (
        <Pregunta titulo="¿En qué idiomas disfrutas la música?" ayuda="Te recomendaré donde te sientas cómodo/a.">
          <div className="flex flex-wrap justify-center gap-2">
            {LANGUAGES.map((l) => (
              <Chip key={l} label={l} active={a.languages.includes(l)} onClick={() => toggle("languages", l)} />
            ))}
          </div>
        </Pregunta>
      ),
    },
    {
      key: "seeks",
      render: () => (
        <Pregunta titulo="¿Qué buscas en un disco?" ayuda="Lo que más te importa al escuchar.">
          <div className="flex flex-wrap justify-center gap-2">
            {SEEKS.map((s) => (
              <Chip key={s} label={s} active={a.seeks.includes(s)} onClick={() => toggle("seeks", s)} />
            ))}
          </div>
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
    <main className="flex min-h-[100dvh] flex-col px-6 pb-8 pt-10">
      {/* Progreso */}
      <div className="mx-auto flex w-full max-w-sm items-center gap-1.5">
        {pasos.slice(1).map((p, i) => (
          <span
            key={p.key}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < step ? "bg-album" : "bg-white/12"
            }`}
          />
        ))}
      </div>

      <div className="flex flex-1 items-center justify-center">
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

      {/* Navegación */}
      <div className="mx-auto w-full max-w-sm">
        {esUltimo && !tieneSeñal && (
          <p className="mb-3 text-center text-xs text-dim">
            Elige al menos un género o un artista para que tu primer disco sea tuyo.
          </p>
        )}
        <div className="flex items-center gap-3">
          {!esBienvenida && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={saving}
              className="rounded-full border border-white/15 px-5 py-3 text-sm text-dim transition-colors hover:text-foreground disabled:opacity-40"
            >
              Atrás
            </button>
          )}
          {esUltimo ? (
            <button
              type="button"
              onClick={finalizar}
              disabled={saving || !tieneSeñal}
              className="flex-1 rounded-full bg-album px-6 py-3.5 text-base font-semibold text-black transition-all active:scale-[0.98] disabled:opacity-40"
            >
              {saving ? "Creando tu primer disco…" : "Crear mi primer disco ✦"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
              className="flex-1 rounded-full bg-album px-6 py-3.5 text-base font-semibold text-black transition-all active:scale-[0.98]"
            >
              {esBienvenida ? "Empezar" : "Siguiente"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

// ─── Piezas ──────────────────────────────────────────────────────────────────

function Centro({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center text-center">{children}</div>;
}

function Pregunta({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="font-serif text-2xl leading-snug">{titulo}</h2>
      {ayuda && <p className="mt-2 max-w-xs text-sm text-dim">{ayuda}</p>}
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
      className="w-full rounded-full border border-white/15 bg-surface px-4 py-3 text-center text-sm transition-colors placeholder:text-white/25 focus:border-album focus:outline-none focus:ring-2 focus:ring-album/25"
    />
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      layout
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
      className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-[border-color,color,background-color] duration-200 ${
        active
          ? "border-album bg-album text-black shadow-[0_0_24px_rgba(200,162,74,0.45)]"
          : "border-white/20 bg-surface text-foreground/75 hover:border-white/35 hover:text-foreground"
      }`}
    >
      {active ? "✓ " : ""}
      {label}
    </motion.button>
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
    <div className="mx-auto w-full max-w-sm">
      {answers.artists.length > 0 && (
        <div className="mb-3 flex flex-wrap justify-center gap-2">
          {answers.artists.map((name) => (
            <motion.span
              key={name}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 rounded-full border border-album bg-album py-1 pl-1 pr-3 text-sm font-medium text-black"
            >
              {answers.artistImages[name] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={answers.artistImages[name]} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-black/20" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/15 text-xs">♪</span>
              )}
              {name}
              <button type="button" onClick={() => remove(name)} aria-label={`Quitar ${name}`} className="text-black/60 hover:text-black">
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
          className="w-full rounded-full border border-white/15 bg-surface px-4 py-3 text-center text-sm transition-colors placeholder:text-white/25 focus:border-album focus:outline-none focus:ring-2 focus:ring-album/25"
        />
        <AnimatePresence>
          {visibles.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-white/10 bg-surface p-1.5 text-left shadow-2xl"
            >
              {visibles.map((s) => (
                <li key={s.name}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      add(s.name, s.image);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors hover:bg-white/5"
                  >
                    {s.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/10" />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-base">♪</span>
                    )}
                    <span className="truncate font-medium">{s.name}</span>
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
