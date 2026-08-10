// La cabecera de la publicación: el gesto que convierte la app en una revista.
//
// Es una tira finísima que va arriba de TODAS las pantallas con el nombre, el
// número de la edición (el día del año: hoy es la edición 222 de Musicart) y la
// fecha. En una revista se llama "titulillo" o folio corrido, y es lo primero
// que te dice que lo que tienes en la mano es una publicación con periodicidad,
// no una pantalla que existe fuera del tiempo.
//
// Nace de la queja del dueño: "todas las apps se ven iguales". Ninguna app se
// abre con un folio corrido; todas las revistas del mundo, sí.

import Link from "next/link";
import { SelectorEdicion } from "./ThemeToggle";

const ZONA = "America/Caracas";

/** Número de edición = día del año. La del 1 de enero es la № 1. */
function numeroDeEdicion(hoy: Date): number {
  const inicio = new Date(hoy.getFullYear(), 0, 0);
  return Math.floor((hoy.getTime() - inicio.getTime()) / 86_400_000);
}

export function Cabecera({ edicion }: { edicion: "light" | "dark" }) {
  const hoy = new Date();
  const fecha = new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: ZONA,
  })
    .format(hoy)
    .replace(".", "");

  return (
    <header className="sticky top-0 z-30 bg-papel">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-5 pb-1.5 pt-[calc(env(safe-area-inset-top)+0.55rem)]">
        <Link href="/" className="rotulo shrink-0 !text-tinta">
          Musicart
        </Link>
        <span className="dato truncate text-[10px] text-tinta-suave">
          № {numeroDeEdicion(hoy)} · {fecha}
        </span>
        <SelectorEdicion edicion={edicion} />
      </div>
      {/* El filete que cierra la cabecera. Dos rayas, como en la portada de un
          diario: una gruesa y una fina. */}
      <div className="mx-auto max-w-lg px-5">
        <div className="border-t-2 border-tinta" />
        <div className="mt-[2px] border-t border-regla" />
      </div>
    </header>
  );
}
