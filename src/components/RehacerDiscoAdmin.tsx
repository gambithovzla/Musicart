"use client";

// Botón solo-admin (Fase 6): rehace el disco de hoy a la medida. Borra el pick
// guardado y fabrica uno fresco (1-3 min). Pensado para el dueño: "genero el
// disco que me dé la gana, cuando me dé la gana". No aparece para usuarios.
// Incluye un cuadro para dialogar con el curador ("hoy quiero rock en inglés,
// estilo Linkin Park") y un selector de idioma. Si no escribes nada, el curador
// elige con el criterio de siempre (tu gusto, diario y ánimo).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE } from "@/lib/device";

const IDIOMAS = ["Español", "English", "Italiano", "Français", "Português", "Cualquiera"];

export function RehacerDiscoAdmin({ dateKey }: { dateKey: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"idle" | "eligiendo" | "trabajando" | "error">("idle");
  const [instruccion, setInstruccion] = useState("");

  async function rehacer(lang: string) {
    setEstado("trabajando");
    document.cookie = `${LANG_COOKIE}=${dateKey}|${encodeURIComponent(lang)}; path=/; max-age=86400; samesite=lax`;
    try {
      const res = await fetch("/api/pick-hoy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rehacer: true, instruccion: instruccion.trim() || undefined }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (!data.ok) {
        setEstado("error");
        return;
      }
      router.refresh();
      setEstado("idle");
    } catch {
      setEstado("error");
    }
  }

  if (estado === "eligiendo") {
    return (
      <div className="px-6 pt-4 text-center">
        <p className="mb-2 text-xs text-dim">
          ¿Qué disco quieres hoy? Dile al curador lo que se te antoje (género, idioma,
          estilo, un artista parecido…). Si lo dejas vacío, elige con tu gusto de siempre.
        </p>
        <textarea
          value={instruccion}
          onChange={(e) => setInstruccion(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Ej: hoy quiero rock en inglés, algo tipo Linkin Park"
          className="mb-3 w-full resize-none rounded-2xl border border-album/40 bg-transparent px-4 py-2 text-sm text-album-light placeholder:text-dim/70 focus:border-album focus:outline-none"
        />
        <p className="mb-3 text-xs text-dim">¿En qué idioma rehacemos hoy?</p>
        <div className="flex flex-wrap justify-center gap-2">
          {IDIOMAS.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => rehacer(lang)}
              className="rounded-full border border-album/40 px-4 py-2 text-xs text-album-light transition-colors hover:bg-album/10"
            >
              {lang}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pt-4 text-center">
      <button
        onClick={() => setEstado("eligiendo")}
        disabled={estado === "trabajando"}
        className="rounded-full border border-album/40 px-4 py-2 text-xs text-album-light transition-colors hover:bg-album/10 disabled:opacity-50"
      >
        {estado === "trabajando"
          ? "Fabricando otro disco a tu medida… (1-3 min)"
          : "✦ Admin · Rehacer mi disco de hoy"}
      </button>
      {estado === "error" && (
        <p className="mt-2 text-xs text-red-300/90">
          No se pudo rehacer ahora. Intenta de nuevo en un momento.
        </p>
      )}
    </div>
  );
}
