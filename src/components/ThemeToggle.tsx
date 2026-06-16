"use client";

// Toggle de apariencia claro/oscuro. Guarda la elección en una cookie y
// recarga el layout para que el HTML reciba la clase correcta sin flash.

import { useRouter } from "next/navigation";
import { THEME_COOKIE } from "@/lib/device";

export function ThemeToggle({ current }: { current: "light" | "dark" }) {
  const router = useRouter();
  const isLight = current === "light";

  function toggle() {
    const next = isLight ? "dark" : "light";
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-surface p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">Apariencia</p>
          <p className="mt-0.5 text-sm text-dim">
            {isLight ? "Modo claro activado" : "Modo oscuro activado"}
          </p>
        </div>
        <button
          onClick={toggle}
          type="button"
          aria-label={isLight ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
          className="relative h-7 w-14 shrink-0 rounded-full border border-white/20 bg-background transition-colors"
        >
          <span
            className="absolute top-0.5 h-6 w-6 rounded-full bg-album shadow transition-[left]"
            style={{ left: isLight ? "calc(100% - 1.625rem)" : "0.125rem" }}
          />
        </button>
      </div>
      <p className="mt-3 text-xs text-dim">
        {isLight
          ? "Claro — ideal para leer a la luz del día"
          : "Oscuro — la editorial nocturna de siempre"}
      </p>
    </section>
  );
}
