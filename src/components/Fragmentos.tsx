"use client";

// LOS FRAGMENTOS — oír el disco dentro de la app.
//
// Hasta ahora el dossier se leía en silencio y para oír una nota había que
// saltar a Spotify. Esto trae los avances de 30 s (iTunes, gratis) y los toca
// aquí mismo: un solo <audio> para toda la página (si suena otra, se calla la
// anterior), y cada canción lleva su botón con forma de VINILO que gira mientras
// suena. Es lo único redondo que se permite la imprenta, porque un disco es
// redondo de verdad (regla 1: `.circulo`).
//
// Si iTunes no tiene el disco, no aparece ningún botón: los fragmentos son un
// plus, nunca algo que pueda fallarle al oyente.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Fragmento = { position: number; title: string; url: string };

type Estado = {
  disponibles: Map<number, Fragmento>;
  cargando: boolean;
  sonando: number | null;
  progreso: number; // 0-1
  alternar: (position: number) => void;
  parar: () => void;
};

const Ctx = createContext<Estado | null>(null);

export function FragmentosProvider({ albumId, children }: { albumId: string; children: ReactNode }) {
  const [disponibles, setDisponibles] = useState<Map<number, Fragmento>>(new Map());
  const [cargando, setCargando] = useState(true);
  const [sonando, setSonando] = useState<number | null>(null);
  const [progreso, setProgreso] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/fragmentos/${albumId}`, { signal: c.signal })
      .then((r) => (r.ok ? r.json() : { fragmentos: [] }))
      .then((d: { fragmentos?: Fragmento[] }) => {
        setDisponibles(new Map((d.fragmentos ?? []).map((f) => [f.position, f])));
      })
      .catch(() => {})
      .finally(() => setCargando(false));
    return () => c.abort();
  }, [albumId]);

  // Al salir de la página, que no siga sonando.
  useEffect(() => () => audio.current?.pause(), []);

  const parar = useCallback(() => {
    audio.current?.pause();
    setSonando(null);
    setProgreso(0);
  }, []);

  const alternar = useCallback(
    (position: number) => {
      const f = disponibles.get(position);
      if (!f) return;
      if (!audio.current) {
        const a = new Audio();
        a.preload = "none";
        a.addEventListener("timeupdate", () => {
          if (a.duration) setProgreso(a.currentTime / a.duration);
        });
        a.addEventListener("ended", () => {
          setSonando(null);
          setProgreso(0);
        });
        audio.current = a;
      }
      const a = audio.current;
      if (sonando === position) {
        parar();
        return;
      }
      a.src = f.url;
      setProgreso(0);
      setSonando(position);
      a.play().catch(() => setSonando(null));
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(6);
    },
    [disponibles, sonando, parar],
  );

  const valor = useMemo(
    () => ({ disponibles, cargando, sonando, progreso, alternar, parar }),
    [disponibles, cargando, sonando, progreso, alternar, parar],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useFragmentos(): Estado | null {
  return useContext(Ctx);
}

/** El vinilo: gira mientras suena y su borde se entinta con el avance. */
export function Vinilo({
  sonando,
  progreso,
  tamaño = 30,
}: {
  sonando: boolean;
  progreso: number;
  tamaño?: number;
}) {
  return (
    <span
      aria-hidden
      className="circulo relative inline-block shrink-0"
      style={{
        width: tamaño,
        height: tamaño,
        // El anillo de avance: la tinta del disco va llenando el borde.
        background: sonando
          ? `conic-gradient(var(--acento) ${progreso * 360}deg, var(--regla) 0deg)`
          : "var(--regla)",
        padding: 2,
      }}
    >
      <span
        className={`circulo vinilo-surco block h-full w-full ${sonando ? "vinilo-gira" : ""}`}
      >
        <span
          className="circulo absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 bg-acento"
          style={{ width: tamaño * 0.34, height: tamaño * 0.34 }}
        />
      </span>
    </span>
  );
}

/** Botón de una canción: 48px de dedo (regla VIII.a), vinilo dentro. */
export function BotonFragmento({ position, title }: { position: number; title: string }) {
  const f = useFragmentos();
  if (!f || !f.disponibles.has(position)) return null;
  const suena = f.sonando === position;
  return (
    <button
      type="button"
      onClick={() => f.alternar(position)}
      aria-pressed={suena}
      aria-label={suena ? `Parar «${title}»` : `Oír 30 segundos de «${title}»`}
      className="pulsable flex h-12 w-12 shrink-0 items-center justify-center"
    >
      <Vinilo sonando={suena} progreso={suena ? f.progreso : 0} />
    </button>
  );
}

/**
 * El sello de "oír un fragmento" para la portada: toca la canción que se le
 * pida (la que da título al disco si existe, si no la primera con avance).
 */
export function SelloFragmento({
  preferida,
  className = "",
}: {
  preferida?: string;
  className?: string;
}) {
  const f = useFragmentos();
  if (!f || f.disponibles.size === 0) return null;
  const lista = [...f.disponibles.values()];
  const n = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
  const elegida =
    (preferida && lista.find((x) => n(x.title) === n(preferida))) || lista[0];
  const suena = f.sonando === elegida.position;
  return (
    <button
      type="button"
      onClick={() => f.alternar(elegida.position)}
      aria-pressed={suena}
      className={`sello-hueco w-full justify-start gap-3 ${className}`}
    >
      <Vinilo sonando={suena} progreso={suena ? f.progreso : 0} tamaño={26} />
      <span className="dato sello-libre min-w-0 flex-1 truncate text-left">
        {suena ? "Sonando · " : "Oír 30 s · "}
        <span>«{elegida.title}»</span>
      </span>
    </button>
  );
}
