"use client";

// Gate del día: aparece una vez al día, antes del álbum.
// Dos pasos en una sola pantalla:
//   1) ¿Qué te apetece hoy? — chips de género/ánimo + un cuadro de texto libre
//      donde el oyente escribe lo que quiera ("rock con energía", "algo tipo
//      Linkin Park"). Es opcional: si lo deja vacío, el curador elige con su gusto.
//   2) ¿En qué idioma? — al tocar un idioma se guardan ambas cosas (pedido +
//      idioma) en cookies de 24h y se recarga para fabricar el disco.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, PEDIDO_COOKIE } from "@/lib/device";

const IDIOMAS = ["Español", "English", "Italiano", "Français", "Português", "Cualquiera"];

// Atajos para el antojo del día. Al tocarlos llenan el cuadro de texto; el
// oyente puede luego editarlo a mano para pedir algo más concreto.
const ANTOJOS = [
  "Rock",
  "Pop",
  "Hip-hop",
  "Electrónica",
  "Jazz",
  "R&B / Soul",
  "Indie",
  "Clásica",
  "Algo con energía",
  "Algo tranquilo",
];

export function LanguageGate({ dateKey }: { dateKey: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [pedido, setPedido] = useState("");

  function elegirAntojo(antojo: string) {
    // Toca el mismo chip para quitarlo; si no, lo pone en el cuadro.
    setPedido((prev) => (prev.trim() === antojo ? "" : antojo));
  }

  function pick(lang: string) {
    if (selected) return;
    setSelected(lang);
    const texto = pedido.trim();
    if (texto) {
      document.cookie = `${PEDIDO_COOKIE}=${dateKey}|${encodeURIComponent(texto)}; path=/; max-age=86400; samesite=lax`;
    }
    document.cookie = `${LANG_COOKIE}=${dateKey}|${encodeURIComponent(lang)}; path=/; max-age=86400; samesite=lax`;
    router.refresh();
  }

  return (
    <main className="flex min-h-[80dvh] flex-col items-center justify-center gap-8 px-8 py-12 text-center">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-dim">Antes de empezar</p>
        <h1 className="font-serif mt-3 text-2xl leading-snug">
          ¿Qué te apetece escuchar hoy?
        </h1>
        <p className="mt-2 text-sm text-dim">
          Pide lo que se te antoje o déjalo en mis manos — mañana volvemos a empezar
        </p>
      </div>

      <div className="w-full max-w-md">
        <div className="flex flex-wrap justify-center gap-2">
          {ANTOJOS.map((antojo) => (
            <button
              key={antojo}
              type="button"
              disabled={!!selected}
              onClick={() => elegirAntojo(antojo)}
              className={`rounded-full border px-4 py-2 text-sm transition-all active:scale-95 disabled:opacity-60 ${
                pedido.trim() === antojo
                  ? "border-album bg-album text-black"
                  : "border-white/15 bg-surface text-foreground/85 hover:border-white/35"
              }`}
            >
              {antojo}
            </button>
          ))}
        </div>

        <textarea
          value={pedido}
          onChange={(e) => setPedido(e.target.value)}
          disabled={!!selected}
          rows={2}
          maxLength={500}
          placeholder="O escríbelo tú: «hoy me siento rockero, algo con energía para arrancar»"
          className="mt-4 w-full resize-none rounded-2xl border border-white/15 bg-surface px-4 py-3 text-sm text-foreground placeholder:text-dim/70 focus:border-album focus:outline-none disabled:opacity-60"
        />
      </div>

      <div>
        <p className="mb-3 text-sm text-dim">¿En qué idioma quieres escuchar hoy?</p>
        <div className="flex flex-wrap justify-center gap-3">
          {IDIOMAS.map((lang) => (
            <button
              key={lang}
              type="button"
              disabled={!!selected}
              onClick={() => pick(lang)}
              className={`rounded-full border px-6 py-3 text-sm font-medium transition-all active:scale-95 disabled:opacity-60 ${
                selected === lang
                  ? "border-album bg-album text-black"
                  : lang === "Cualquiera"
                    ? "border-white/15 bg-surface text-dim hover:border-white/30 hover:text-foreground"
                    : "border-white/20 bg-surface text-foreground/85 hover:border-white/40"
              }`}
            >
              {selected === lang ? "✓ " : ""}{lang}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-dim/70">Elige idioma para crear tu disco de hoy</p>
      </div>

      {selected && <p className="text-xs text-dim">Creando tu disco…</p>}
    </main>
  );
}
