// Las tres puertas grandes de Explorar.
//
// Existen porque la barra de abajo llegó a tener siete pestañas y "Caminos",
// "Salón" y "Vitrina" son tres cosas muy distintas que en una etiqueta de 11px
// parecían la misma. Aquí cada una dice en una frase qué es y —sobre todo— en
// qué se diferencia de las otras: el ROADMAP lleva desde la Fase 8 avisando de
// que si no se explica la diferencia, se canibalizan.

import Link from "next/link";

const PUERTAS = [
  {
    href: "/caminos",
    emoji: "🧭",
    titulo: "Caminos",
    frase:
      "¿Quieres entrar a un género y no sabes por dónde? Cinco discos en orden, cada uno te deja el oído listo para el siguiente.",
  },
  {
    href: "/salon",
    emoji: "🏛",
    titulo: "El Salón de la Fama",
    frase:
      "El veredicto de la historia: los discos 100 de 100, con los datos que lo respaldan. Pídeme uno de la altura que quieras.",
  },
  {
    href: "/vitrina",
    emoji: "🖼",
    titulo: "La vitrina",
    frase:
      "Aquí no opina la historia, opino yo: los discos que atesoro, con mi puntaje y mi canción favorita.",
  },
];

export function PuertasExplorar() {
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {PUERTAS.map((p) => (
        <li key={p.href}>
          <Link
            href={p.href}
            className="flex h-full gap-3 rounded-2xl border border-white/10 bg-surface p-4 transition-all hover:border-album/40 active:scale-[0.99] sm:flex-col"
          >
            <span className="text-2xl leading-none" aria-hidden>
              {p.emoji}
            </span>
            <span className="min-w-0">
              <span className="font-serif block text-lg font-medium">
                {p.titulo}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-dim">
                {p.frase}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
