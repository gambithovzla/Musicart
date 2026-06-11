"use client";

// Gate de idioma: aparece una vez al día, antes del álbum.
// El usuario elige en qué idioma quiere escuchar hoy o toca "Cualquiera".
// Guarda la elección en una cookie de 24h y recarga la página.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE } from "@/lib/device";

const OPTIONS = ["Español", "English", "Italiano", "Français", "Português", "Cualquiera"];

export function LanguageGate({ dateKey }: { dateKey: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  function pick(lang: string) {
    if (selected) return;
    setSelected(lang);
    document.cookie = `${LANG_COOKIE}=${dateKey}|${encodeURIComponent(lang)}; path=/; max-age=86400; samesite=lax`;
    router.refresh();
  }

  return (
    <main className="flex min-h-[80dvh] flex-col items-center justify-center gap-8 px-8 text-center">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-dim">Antes de empezar</p>
        <h1 className="font-serif mt-3 text-2xl leading-snug">
          ¿En qué idioma quieres escuchar hoy?
        </h1>
        <p className="mt-2 text-sm text-dim">
          Mañana te pregunto de nuevo — cada día puede ser diferente
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {OPTIONS.map((lang) => (
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

      {selected && (
        <p className="text-xs text-dim">Cargando tu disco…</p>
      )}
    </main>
  );
}
