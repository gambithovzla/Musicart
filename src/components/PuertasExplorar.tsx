// EL SUMARIO — las puertas grandes de Explorar (cuatro desde la Fase 11).
//
// Antes: tres tarjetas redondeadas con un emoji dentro (🧭 🏛 🖼). El emoji como
// icono es, después de las esquinas redondeadas, la firma más delatora de la
// plantilla: es lo que se pone cuando no se ha decidido qué es cada cosa.
//
// Ahora es el SUMARIO de la publicación, que es exactamente lo que estas
// puertas son: cada sección con su número romano, su nombre en display y la
// frase que dice en qué se diferencia de las demás. El ROADMAP lleva avisando
// desde la Fase 8 de que si no se explica la diferencia, se canibalizan — en un
// sumario esa frase es literalmente el formato. Con el Atlas dentro son cuatro,
// y las tres primeras son tres maneras distintas de entrar a la música: por
// GÉNERO (Caminos), por PRESTIGIO (Salón) y por LUGAR (Conociendo a…).

import Link from "next/link";

const SECCIONES = [
  {
    href: "/caminos",
    romano: "I",
    titulo: "Caminos",
    sumario:
      "¿Quieres entrar a un género y no sabes por dónde? Cinco discos en orden, cada uno te deja el oído listo para el siguiente.",
  },
  {
    href: "/salon",
    romano: "II",
    titulo: "El Salón de la Fama",
    sumario:
      "El veredicto de la historia: los discos 100 de 100, con los datos que lo respaldan. Pídeme uno de la altura que quieras.",
  },
  {
    href: "/atlas",
    romano: "III",
    titulo: "Conociendo a…",
    sumario:
      "Elige un país y te lo cuento en cinco discos: de dónde viene su música, con qué se mezcló y qué suena hoy.",
  },
  {
    href: "/vitrina",
    romano: "IV",
    titulo: "La vitrina",
    sumario:
      "Aquí no opina la historia, opino yo: los discos que atesoro, con mi puntaje y mi canción favorita.",
  },
];

export function PuertasExplorar() {
  return (
    <ul className="border-t border-regla">
      {SECCIONES.map((s) => (
        <li key={s.href}>
          <Link href={s.href} className="fila fila-avanza !items-start !py-5">
            {/* El número romano hace de icono, y encima ordena. */}
            <span className="cifra w-8 shrink-0 pt-1 text-2xl text-acento">
              {s.romano}
            </span>
            <span className="min-w-0">
              <span className="font-serif block text-[22px] leading-none">
                {s.titulo}
              </span>
              <span className="mt-2 block text-[14px] leading-relaxed text-tinta-suave">
                {s.sumario}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
