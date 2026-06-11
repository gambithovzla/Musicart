"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { saveProfile } from "@/app/actions";
import { signOutAction } from "@/app/entrar/actions";
import { PrivacyPanel } from "@/components/PrivacyPanel";
import { DuetPanel } from "@/components/DuetPanel";
import { PushToggle } from "@/components/PushToggle";
import type { DuetSummary } from "@/lib/duet";
import { SubscriptionPanel } from "@/components/SubscriptionPanel";
import { getDeviceId } from "@/lib/device";

const MOMENTS = ["Manejando", "Trabajando", "En casa", "Entrenando", "Antes de dormir"];
const SEEKS = ["La historia", "La emoción", "La técnica", "Descubrir lo nuevo"];
const TIMES = ["20 min", "45 min", "1 hora o más"];
const GENRES = [
  "Rock", "Pop", "Jazz", "Salsa", "Hip-hop", "Electrónica", "Indie", "Metal",
  "Clásica", "Folk", "R&B / Soul", "Reggae", "Punk", "Blues", "Cumbia",
  "Bolero", "Funk", "Reguetón", "Trap", "Bossa nova",
];
const INTERESTS = [
  "Fútbol", "Deportes", "Literatura", "Cine", "Filosofía", "Arte",
  "Tecnología", "Viajes", "Cocina", "Gaming", "Teatro", "Fotografía",
];

export type ProfileAnswers = {
  moments: string[];
  seeks: string[];
  genres: string[];
  artists: string[];
  interests: string[];    // quién eres más allá de la música
  bio?: string;           // línea libre opcional: trabajo, rutina, contexto
  artistImages?: Record<string, string>; // nombre → foto (solo para mostrar)
  anchors?: string; // libre, opcional (perfiles antiguos); ya no se muestra
  listenTime: string;
};

type ArtistSuggestion = { name: string; image: string | null };

const EMPTY: ProfileAnswers = {
  moments: [], seeks: [], genres: [], artists: [], interests: [], listenTime: "",
};
const STORAGE_KEY = "musicart:profile";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type UserInfo = {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
};

type SubscriptionInfo = {
  isPro: boolean;
  used: number;
  limit: number;
  stripeReady: boolean;
  status: string | null;
};

export function ProfileForm({
  user,
  isAdmin = false,
  initialAnswers,
  duet,
  subscription,
}: {
  user: UserInfo | null;
  isAdmin?: boolean;
  initialAnswers: Partial<ProfileAnswers> | null;
  duet?: DuetSummary | null;
  subscription?: SubscriptionInfo;
}) {
  const [answers, setAnswers] = useState<ProfileAnswers>(EMPTY);
  const [artistInput, setArtistInput] = useState("");
  const [suggestions, setSuggestions] = useState<ArtistSuggestion[]>([]);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [hydrated, setHydrated] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFlash = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    let merged = { ...EMPTY, ...initialAnswers };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) merged = { ...merged, ...JSON.parse(raw) };
    } catch {
      // perfil local corrupto
    }
    // Perfiles antiguos no traen genres/artists: garantizamos arrays.
    setAnswers({
      ...merged,
      moments: Array.isArray(merged.moments) ? merged.moments : [],
      seeks: Array.isArray(merged.seeks) ? merged.seeks : [],
      genres: Array.isArray(merged.genres) ? merged.genres : [],
      artists: Array.isArray(merged.artists) ? merged.artists : [],
      interests: Array.isArray(merged.interests) ? merged.interests : [],
    });
    setHydrated(true);
  }, [initialAnswers]);

  const persist = useCallback(async (data: ProfileAnswers) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setStatus("saving");
    try {
      await saveProfile(getDeviceId(), data);
      setStatus("saved");
      if (savedFlash.current) clearTimeout(savedFlash.current);
      savedFlash.current = setTimeout(() => setStatus("idle"), 2200);
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist(answers);
    }, 450);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [answers, hydrated, persist]);

  function update(patch: Partial<ProfileAnswers>) {
    setAnswers((a) => ({ ...a, ...patch }));
  }

  function toggle(list: "moments" | "seeks" | "genres" | "interests", value: string) {
    setAnswers((a) => ({
      ...a,
      [list]: a[list].includes(value)
        ? a[list].filter((v) => v !== value)
        : [...a[list], value],
    }));
  }

  function addArtist(name: string, image?: string | null) {
    const value = name.trim();
    if (!value) return;
    setAnswers((a) => {
      if (a.artists.some((x) => x.toLowerCase() === value.toLowerCase())) return a;
      return {
        ...a,
        artists: [...a.artists, value],
        artistImages: image
          ? { ...(a.artistImages ?? {}), [value]: image }
          : a.artistImages,
      };
    });
    setArtistInput("");
    setSuggestions([]);
  }

  function removeArtist(name: string) {
    setAnswers((a) => {
      const images = { ...(a.artistImages ?? {}) };
      delete images[name];
      return { ...a, artists: a.artists.filter((x) => x !== name), artistImages: images };
    });
  }

  // Autocompletado con foto (Deezer vía /api/artists), con debounce.
  useEffect(() => {
    const q = artistInput.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/artists?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { results?: ArtistSuggestion[] };
        setSuggestions(Array.isArray(data.results) ? data.results : []);
      } catch {
        // sin sugerencias: el usuario igual puede escribir y pulsar Enter
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [artistInput]);

  const displayName = user?.name?.split(" ")[0] ?? user?.email?.split("@")[0];

  return (
    <main className="px-6 pb-10 pt-12">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-dim">Tu perfil</p>
        <h1 className="font-serif mt-2 text-3xl font-semibold">
          {user ? `Hola, ${displayName}` : "Cuéntanos quién escucha"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-dim">
          {user
            ? "Tu diario y tus gustos viajan contigo. Los cambios se guardan solos."
            : "Con esto, las recomendaciones pasan de ser genéricas a “este disco, para ti, hoy”."}
        </p>
      </header>

      <AnimatePresence>
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex items-center gap-3 rounded-2xl border border-album/25 bg-album/10 px-4 py-3"
          >
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt=""
                className="h-10 w-10 rounded-full ring-2 ring-album/40"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-album/20 text-sm font-semibold text-album-light">
                {(displayName ?? "?")[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name ?? user.email}</p>
              <p className="truncate text-xs text-dim">Cuenta conectada</p>
            </div>
            <button
              type="button"
              disabled={signingOut}
              onClick={() => startSignOut(() => signOutAction())}
              className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs text-dim transition-colors hover:border-white/30 hover:text-foreground disabled:opacity-50"
            >
              {signingOut ? "Saliendo…" : "Salir"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {isAdmin && (
        <Link
          href="/revision"
          className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-surface px-4 py-3 text-sm transition-colors hover:border-album/40"
        >
          <span>
            <span className="font-medium">Panel de revisión</span>
            <span className="mt-0.5 block text-xs text-dim">
              Drafts, cola y audio TTS
            </span>
          </span>
          <span className="text-dim">→</span>
        </Link>
      )}

      <SaveIndicator status={status} />

      {subscription && (
        <SubscriptionPanel
          isPro={subscription.isPro}
          used={subscription.used}
          limit={subscription.limit}
          hasAccount={Boolean(user)}
          stripeReady={subscription.stripeReady}
          status={subscription.status}
        />
      )}

      <PushToggle />

      {user && duet && <DuetPanel duet={duet} />}

      <section className="mt-8">
        <h2 className="font-serif text-lg">¿Qué géneros te mueven?</h2>
        <p className="mt-1 text-xs text-dim">
          Los que quieras — con esto tu primer disco ya va por tu lado
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {GENRES.map((g) => (
            <Chip
              key={g}
              label={g}
              active={answers.genres.includes(g)}
              onClick={() => toggle("genres", g)}
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg">Artistas que amas</h2>
        <p className="mt-1 text-xs text-dim">
          Escribe un nombre y elígelo de la lista (con su foto). Cuantos más,
          mejor te conocemos.
        </p>

        {answers.artists.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {answers.artists.map((a) => (
              <motion.span
                key={a}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2 rounded-full border border-album bg-album py-1 pl-1 pr-3 text-sm font-medium text-black"
              >
                {answers.artistImages?.[a] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={answers.artistImages[a]}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover ring-1 ring-black/20"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/15 text-xs">
                    ♪
                  </span>
                )}
                {a}
                <button
                  type="button"
                  onClick={() => removeArtist(a)}
                  aria-label={`Quitar ${a}`}
                  className="text-black/60 transition-colors hover:text-black"
                >
                  ✕
                </button>
              </motion.span>
            ))}
          </div>
        )}

        <div className="relative mt-3">
          <input
            value={artistInput}
            onChange={(e) => setArtistInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                // Si hay sugerencias, agrega la primera (con foto); si no, el texto.
                if (suggestions[0]) addArtist(suggestions[0].name, suggestions[0].image);
                else addArtist(artistInput);
              } else if (e.key === "Backspace" && !artistInput && answers.artists.length) {
                removeArtist(answers.artists[answers.artists.length - 1]);
              }
            }}
            placeholder={answers.artists.length ? "Añadir otro…" : "Ej.: Soda Stereo, Radiohead…"}
            className="w-full rounded-full border border-white/15 bg-surface px-4 py-2.5 text-sm transition-colors placeholder:text-white/25 focus:border-album focus:outline-none focus:ring-2 focus:ring-album/25"
          />

          <AnimatePresence>
            {suggestions.filter(
              (s) => !answers.artists.some((a) => a.toLowerCase() === s.name.toLowerCase()),
            ).length > 0 && (
              <motion.ul
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute z-10 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-white/10 bg-surface p-1.5 shadow-2xl"
              >
                {suggestions
                  .filter(
                    (s) =>
                      !answers.artists.some(
                        (a) => a.toLowerCase() === s.name.toLowerCase(),
                      ),
                  )
                  .map((s) => (
                    <li key={s.name}>
                      <button
                        type="button"
                        // onMouseDown: actúa antes de que el input pierda foco.
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addArtist(s.name, s.image);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors hover:bg-white/5"
                      >
                        {s.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.image}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                          />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-base">
                            ♪
                          </span>
                        )}
                        <span className="truncate font-medium">{s.name}</span>
                      </button>
                    </li>
                  ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg">¿Qué más eres tú?</h2>
        <p className="mt-1 text-xs text-dim">
          Aparte de la música — con esto el curador conecta el disco con tu mundo,
          no solo con tus artistas
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTERESTS.map((i) => (
            <Chip
              key={i}
              label={i}
              active={answers.interests.includes(i)}
              onClick={() => toggle("interests", i)}
            />
          ))}
        </div>
        <textarea
          value={answers.bio ?? ""}
          onChange={(e) => update({ bio: e.target.value.slice(0, 200) })}
          placeholder="Algo más opcional… (p. ej. «trabajo de noche», «leo mucho a Borges», «entreno todos los días»)"
          rows={2}
          className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-surface px-4 py-3 text-sm leading-relaxed text-foreground/90 placeholder:text-white/25 focus:border-album/50 focus:outline-none focus:ring-2 focus:ring-album/20"
        />
        {(answers.bio?.length ?? 0) > 0 && (
          <p className="mt-1 text-right text-[0.65rem] text-dim">
            {answers.bio!.length}/200
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg">¿Cuándo escuchas música?</h2>
        <p className="mt-1 text-xs text-dim">Puedes elegir varios</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MOMENTS.map((m) => (
            <Chip
              key={m}
              label={m}
              active={answers.moments.includes(m)}
              onClick={() => toggle("moments", m)}
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg">¿Qué buscas en un disco?</h2>
        <p className="mt-1 text-xs text-dim">Puedes elegir varios</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SEEKS.map((s) => (
            <Chip
              key={s}
              label={s}
              active={answers.seeks.includes(s)}
              onClick={() => toggle("seeks", s)}
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg">¿Cuánto tiempo seguido puedes escuchar?</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {TIMES.map((t) => (
            <Chip
              key={t}
              label={t}
              active={answers.listenTime === t}
              onClick={() => update({ listenTime: answers.listenTime === t ? "" : t })}
            />
          ))}
        </div>
      </section>

      {!user && (
        <motion.a
          href="/entrar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 block rounded-2xl border border-dashed border-white/15 px-6 py-4 text-center text-sm text-dim transition-colors hover:border-album/40 hover:text-foreground"
        >
          Entrar para llevar tu diario a otro dispositivo →
        </motion.a>
      )}

      <PrivacyPanel hasAccount={Boolean(user)} />
    </main>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const label =
    status === "saving"
      ? "Guardando…"
      : status === "saved"
        ? "Cambios guardados ✓"
        : status === "error"
          ? "Sin conexión — se guardó en este dispositivo"
          : null;

  return (
    <AnimatePresence>
      {label && (
        <motion.p
          key={status}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className={`mt-4 text-center text-xs ${
            status === "error" ? "text-red-300/80" : "text-album-light"
          }`}
        >
          {label}
        </motion.p>
      )}
    </AnimatePresence>
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
      className={`relative flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-[border-color,color,box-shadow,background-color] duration-200 ${
        active
          ? "border-album bg-album text-black shadow-[0_0_24px_rgba(200,162,74,0.45)]"
          : "border-white/20 bg-surface text-foreground/75 hover:border-white/35 hover:text-foreground"
      }`}
    >
      <AnimatePresence mode="popLayout">
        {active && (
          <motion.span
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 600, damping: 22 }}
            className="text-xs font-bold"
            aria-hidden
          >
            ✓
          </motion.span>
        )}
      </AnimatePresence>
      {label}
    </motion.button>
  );
}
