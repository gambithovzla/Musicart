"use client";

// EL PIE DE IMPRENTA — lo que antes era la barra de pestañas.
//
// La barra de cuatro iconitos de línea con la etiqueta de 11px debajo y la
// pastilla de color en la activa es, junto con las tarjetas redondeadas, la
// firma más reconocible de "esto lo hizo una IA con la plantilla de siempre".
// Es literalmente igual en todas las apps.
//
// Aquí no hay iconos. Las cuatro secciones se numeran en romanos y se nombran
// en versalitas, como las secciones de una revista, y la que estás leyendo se
// ENTINTA: se le da la vuelta al color, papel sobre tinta. Se sigue viendo de
// un vistazo cuál está activa —que es lo único que la barra tiene que hacer—
// pero se ve como el pie de una publicación, no como una app.
//
// Siguen siendo cuatro y no siete (9.8): el ritual, todo lo demás que se puede
// explorar, tu historia y tus ajustes.

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECCIONES = [
  { href: "/", romano: "I", label: "Hoy" },
  {
    href: "/explorar",
    romano: "II",
    label: "Explorar",
    // Dentro de un camino, del Salón o de la vitrina sigues "en Explorar".
    tambien: ["/caminos", "/salon", "/vitrina", "/album"],
  },
  { href: "/diario", romano: "III", label: "Diario" },
  { href: "/perfil", romano: "IV", label: "Perfil" },
];

function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(8);
  }
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-papel">
      <div className="mx-auto max-w-lg px-5">
        <div className="border-t border-regla" />
        <div className="mt-[2px] border-t-2 border-tinta" />
      </div>

      <div className="mx-auto flex max-w-lg items-stretch px-5 pb-[env(safe-area-inset-bottom)]">
        {SECCIONES.map((s, i) => {
          const activa =
            s.href === "/"
              ? pathname === "/"
              : pathname.startsWith(s.href) ||
                (s.tambien ?? []).some((p) => pathname.startsWith(p));
          return (
            <Link
              key={s.href}
              href={s.href}
              onClick={haptic}
              aria-current={activa ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-[3px] py-2.5 transition-colors ${
                i > 0 ? "border-l border-regla-tenue" : ""
              } ${activa ? "bg-tinta text-papel" : "text-tinta-suave active:bg-tinta/10"}`}
            >
              <span
                className={`dato text-[9px] leading-none ${
                  activa ? "opacity-70" : "opacity-50"
                }`}
              >
                {s.romano}
              </span>
              <span className="dato text-[10px] uppercase leading-none tracking-[0.14em]">
                {s.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
