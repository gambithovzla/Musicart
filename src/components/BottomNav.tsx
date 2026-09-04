"use client";

// EL PIE DE IMPRENTA — la barra de secciones.
//
// Segunda versión, y con una lección aprendida. En la primera quité los iconos
// enteros: cuatro números romanos y una etiqueta de 10px. Se veía muy digno y
// se usaba fatal — el dueño lo dijo en cuanto lo tuvo en la mano: "no se ve
// interactiva, la otra parecía una app nativa y eso es mejor".
//
// Tenía razón, y el error era de criterio: la FORMA de una barra de pestañas
// (icono + etiqueta, abajo, siempre visible) no es un gesto de plantilla, es una
// convención de plataforma. Pelearla cuesta usabilidad y no gana identidad,
// porque la identidad de Musicart no vive aquí — vive en la tipografía, las
// reglas, los folios y las cifras.
//
// Así que los iconos vuelven, pero DIBUJADOS EN ESTE IDIOMA: marcas macizas de
// tinta (un disco, una lupa de imprenta, un cuadernillo, un sello), no los
// contornos redondeados de 1.8px que traen todas las librerías. Y la pestaña
// activa se entinta de acento con su filete grueso encima, que es lo que hacía
// la barra vieja con su pastilla, pero contado en impreso.
//
// Objetivo táctil: 60px de alto (regla VIII.a).

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECCIONES = [
  {
    href: "/",
    label: "Hoy",
    // El disco: un círculo macizo con su agujero. La marca de la casa.
    icono: (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden>
        <circle cx="12" cy="12" r="9.5" fill="currentColor" />
        <circle cx="12" cy="12" r="2.4" className="fill-papel" />
      </svg>
    ),
  },
  {
    href: "/explorar",
    label: "Explorar",
    // Dentro de un camino, del Salón o de la vitrina sigues "en Explorar".
    tambien: ["/caminos", "/salon", "/vitrina", "/album"],
    // La lupa, con mango recto y grueso: un instrumento, no un contorno fino.
    icono: (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden>
        <circle
          cx="10.5"
          cy="10.5"
          r="6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path d="M15.5 15.5 L21 21" stroke="currentColor" strokeWidth="3.4" />
      </svg>
    ),
  },
  {
    href: "/diario",
    label: "Diario",
    // El cuadernillo: lomo macizo y sus renglones.
    icono: (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden>
        <rect x="3" y="3.5" width="4" height="17" fill="currentColor" />
        <rect
          x="8"
          y="3.5"
          width="13"
          height="17"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <path d="M11 9h7M11 13h7M11 17h4" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    href: "/perfil",
    label: "Perfil",
    // El sello del suscriptor: marco entintado con su busto dentro.
    icono: (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden>
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <circle cx="12" cy="9.8" r="2.9" fill="currentColor" />
        <path
          d="M6.8 18.2c.9-2.9 2.8-4.3 5.2-4.3s4.3 1.4 5.2 4.3z"
          fill="currentColor"
        />
      </svg>
    ),
  },
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
        {SECCIONES.map((s) => {
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
              className={`relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1.5 transition-colors ${
                activa ? "text-acento" : "text-tinta-suave active:bg-tinta/10"
              }`}
            >
              {/* El filete de la pestaña activa: grueso, entintado, encima. */}
              {activa && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 top-0 h-[3px] bg-acento"
                />
              )}
              {s.icono}
              <span className="dato text-[11px] uppercase leading-none tracking-[0.1em]">
                {s.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
