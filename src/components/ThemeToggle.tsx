"use client";

// La tirada: de día o de noche.
//
// Antes esto era el interruptor de iOS de toda la vida (la pastillita gris con
// la bolita que se desliza). Ahora no hay "modo oscuro": hay DOS EDICIONES de
// la misma publicación, y eliges cuál te imprimen. Se guarda en cookie y se
// recarga el layout para que el HTML reciba la clase sin parpadeo.

import { useRouter } from "next/navigation";
import { THEME_COOKIE } from "@/lib/device";

function fijarEdicion(next: "light" | "dark") {
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
}

/** El conmutador diminuto del folio corrido: "DÍA / NOCHE". */
export function SelectorEdicion({ edicion }: { edicion: "light" | "dark" }) {
  const router = useRouter();
  const esDia = edicion === "light";

  return (
    <button
      type="button"
      onClick={() => {
        fijarEdicion(esDia ? "dark" : "light");
        router.refresh();
      }}
      aria-label={esDia ? "Cambiar a la edición de noche" : "Cambiar a la edición de día"}
      className="dato flex min-h-[44px] shrink-0 items-center pl-2 text-[11px] uppercase tracking-[0.14em] text-tinta-suave active:text-tinta"
    >
      <span className={esDia ? "text-tinta" : ""}>Día</span>
      <span className="mx-1 opacity-40">/</span>
      <span className={esDia ? "" : "text-tinta"}>Noche</span>
    </button>
  );
}

/** El control completo, para la página de perfil. */
export function ThemeToggle({ current }: { current: "light" | "dark" }) {
  const router = useRouter();
  const esDia = current === "light";

  function elegir(next: "light" | "dark") {
    fijarEdicion(next);
    router.refresh();
  }

  return (
    <section className="mt-10">
      <div className="cabecera-seccion">
        <span className="rotulo">La tirada</span>
        <span className="dato text-[10px] text-tinta-suave">
          {esDia ? "DÍA" : "NOCHE"}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-tinta-suave">
        Musicart se imprime en dos ediciones. La de noche es tinta clara sobre
        papel oscuro; la de día, papel prensa. El contenido es el mismo.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {(
          [
            { valor: "light", nombre: "Edición de día", pie: "Papel prensa" },
            { valor: "dark", nombre: "Edición de noche", pie: "Tinta sobre negro" },
          ] as const
        ).map((op) => {
          const activa = op.valor === current;
          return (
            <button
              key={op.valor}
              type="button"
              onClick={() => elegir(op.valor)}
              aria-pressed={activa}
              className={`px-3 py-3 text-left transition-colors ${
                activa
                  ? "border border-tinta bg-tinta text-papel"
                  : "border border-regla text-tinta-suave hover:border-tinta hover:text-tinta"
              }`}
            >
              <span className="dato block text-[10px] uppercase tracking-[0.16em]">
                {op.nombre}
              </span>
              <span className="mt-1 block text-[11px] opacity-70">{op.pie}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
