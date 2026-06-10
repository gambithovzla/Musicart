"use client";

// Onboarding ligero: el perfil que alimentará las recomendaciones personalizadas.
// Se guarda local + en DB (anónimo por dispositivo); fase 2 lo usa el motor de IA.

import { useEffect, useState } from "react";
import { saveProfile } from "@/app/actions";
import { getDeviceId } from "@/lib/device";

const MOMENTS = ["Manejando", "Trabajando", "En casa", "Entrenando", "Antes de dormir"];
const SEEKS = ["La historia", "La emoción", "La técnica", "Descubrir lo nuevo"];
const TIMES = ["20 min", "45 min", "1 hora o más"];

type ProfileAnswers = {
  moments: string[];
  seeks: string[];
  anchors: string;
  listenTime: string;
};

const EMPTY: ProfileAnswers = { moments: [], seeks: [], anchors: "", listenTime: "" };
const STORAGE_KEY = "musicart:profile";

export default function PerfilPage() {
  const [answers, setAnswers] = useState<ProfileAnswers>(EMPTY);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setAnswers({ ...EMPTY, ...JSON.parse(raw) });
    } catch {
      // perfil corrupto: se parte de cero
    }
  }, []);

  function toggle(list: keyof Pick<ProfileAnswers, "moments" | "seeks">, value: string) {
    setSaved(false);
    setAnswers((a) => ({
      ...a,
      [list]: a[list].includes(value)
        ? a[list].filter((v) => v !== value)
        : [...a[list], value],
    }));
  }

  async function persist() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    setSaved(true);
    try {
      await saveProfile(getDeviceId(), answers);
    } catch {
      // sin conexión: queda en localStorage y se reintenta al volver a guardar
    }
  }

  return (
    <main className="px-6 pb-10 pt-12">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-dim">Tu perfil</p>
        <h1 className="font-serif mt-2 text-3xl font-semibold">
          Cuéntanos quién escucha
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-dim">
          Con esto, las recomendaciones dejarán de ser “gente que escuchó X también
          escuchó…” y empezarán a ser “este disco, para ti, hoy”.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="font-serif text-lg">¿Cuándo escuchas música?</h2>
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
              onClick={() => {
                setSaved(false);
                setAnswers((a) => ({ ...a, listenTime: t }));
              }}
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg">Tres discos o artistas que te marcaron</h2>
        <textarea
          value={answers.anchors}
          onChange={(e) => {
            setSaved(false);
            setAnswers((a) => ({ ...a, anchors: e.target.value }));
          }}
          rows={3}
          placeholder="Ej.: Continuum, Héctor Lavoe, AC/DC…"
          className="mt-3 w-full rounded-xl border border-white/10 bg-surface px-4 py-3 text-sm placeholder:text-white/25 focus:border-album/60 focus:outline-none"
        />
      </section>

      <button
        onClick={persist}
        className="mt-8 w-full rounded-2xl bg-album px-6 py-4 text-base font-semibold text-black transition-transform active:scale-[0.98]"
      >
        {saved ? "Perfil guardado ✓" : "Guardar perfil"}
      </button>
    </main>
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
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
        active
          ? "border-album bg-album/15 text-album-light"
          : "border-white/15 text-foreground/70"
      }`}
    >
      {label}
    </button>
  );
}
