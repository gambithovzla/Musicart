"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { saveProfile } from "@/app/actions";
import { signOutAction } from "@/app/entrar/actions";
import { PrivacyPanel } from "@/components/PrivacyPanel";
import { getDeviceId } from "@/lib/device";

const MOMENTS = ["Manejando", "Trabajando", "En casa", "Entrenando", "Antes de dormir"];
const SEEKS = ["La historia", "La emoción", "La técnica", "Descubrir lo nuevo"];
const TIMES = ["20 min", "45 min", "1 hora o más"];

export type ProfileAnswers = {
  moments: string[];
  seeks: string[];
  anchors: string;
  listenTime: string;
};

const EMPTY: ProfileAnswers = { moments: [], seeks: [], anchors: "", listenTime: "" };
const STORAGE_KEY = "musicart:profile";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type UserInfo = {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
};

export function ProfileForm({
  user,
  isAdmin = false,
  initialAnswers,
}: {
  user: UserInfo | null;
  isAdmin?: boolean;
  initialAnswers: Partial<ProfileAnswers> | null;
}) {
  const [answers, setAnswers] = useState<ProfileAnswers>(EMPTY);
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
    setAnswers(merged);
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

  function toggle(list: "moments" | "seeks", value: string) {
    setAnswers((a) => ({
      ...a,
      [list]: a[list].includes(value)
        ? a[list].filter((v) => v !== value)
        : [...a[list], value],
    }));
  }

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

      <section className="mt-8">
        <h2 className="font-serif text-lg">Tres discos o artistas que te marcaron</h2>
        <textarea
          value={answers.anchors}
          onChange={(e) => update({ anchors: e.target.value })}
          rows={3}
          placeholder="Ej.: Continuum, Héctor Lavoe, AC/DC…"
          className="mt-3 w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm transition-colors placeholder:text-white/25 focus:border-album focus:outline-none focus:ring-2 focus:ring-album/25"
        />
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
