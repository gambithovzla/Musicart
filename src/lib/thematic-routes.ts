// Rutas temáticas (Fase 4): colecciones curadas de discos del catálogo publicado.

export type ThematicRoute = {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  albums: { title: string; artist: string }[];
};

export const THEMATIC_ROUTES: ThematicRoute[] = [
  {
    slug: "jazz-esencial",
    title: "Jazz esencial",
    emoji: "🎷",
    description:
      "Modal, cool y atemporal. Los discos que enseñan por qué el jazz sigue siendo una madriguera sin fondo.",
    albums: [
      { title: "Kind of Blue", artist: "Miles Davis" },
    ],
  },
  {
    slug: "rock-legendario",
    title: "Rock legendario",
    emoji: "🎸",
    description:
      "Estudio, concepto y estadio. Clásicos que definieron lo que significa un álbum completo.",
    albums: [
      { title: "Abbey Road", artist: "The Beatles" },
      { title: "The Dark Side of the Moon", artist: "Pink Floyd" },
      { title: "Rumours", artist: "Fleetwood Mac" },
    ],
  },
  {
    slug: "en-espanol",
    title: "En español",
    emoji: "🌹",
    description:
      "Flamenco, pop y tradición con audacia. Historias que solo suenan en nuestra lengua.",
    albums: [
      { title: "El Mal Querer", artist: "Rosalía" },
      { title: "La leyenda del tiempo", artist: "Camarón de la Isla" },
    ],
  },
  {
    slug: "introspeccion",
    title: "Para escuchar con calma",
    emoji: "🌙",
    description:
      "Discos que piden auriculares, un sofá y cero prisa. Perfectos para el ritual de hoy.",
    albums: [
      { title: "Continuum", artist: "John Mayer" },
      { title: "Rumours", artist: "Fleetwood Mac" },
    ],
  },
];

export function findRoute(slug: string): ThematicRoute | undefined {
  return THEMATIC_ROUTES.find((r) => r.slug === slug);
}
