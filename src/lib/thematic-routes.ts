// Rutas temáticas (Fase 4): colecciones curadas de discos del catálogo publicado.

export type ThematicRoute = {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  // `tags`: emparejan discos del catálogo EN VIVO por sus etiquetas (Last.fm),
  // así la ruta se actualiza sola cuando entran discos nuevos que encajan.
  tags?: string[];
  // `albums`: semilla curada que SIEMPRE aparece (clásicos conocidos), aunque
  // sus etiquetas sean pobres.
  albums: { title: string; artist: string }[];
};

export const THEMATIC_ROUTES: ThematicRoute[] = [
  {
    slug: "jazz-esencial",
    title: "Jazz esencial",
    emoji: "🎷",
    description:
      "Modal, cool y atemporal. Los discos que enseñan por qué el jazz sigue siendo una madriguera sin fondo.",
    tags: ["jazz", "bebop", "cool jazz", "modal", "swing", "fusion", "bossa nova"],
    albums: [{ title: "Kind of Blue", artist: "Miles Davis" }],
  },
  {
    slug: "rock-legendario",
    title: "Rock legendario",
    emoji: "🎸",
    description:
      "Estudio, concepto y estadio. Clásicos que definieron lo que significa un álbum completo.",
    tags: [
      "rock", "classic rock", "hard rock", "progressive rock", "psychedelic",
      "rock and roll", "punk", "grunge", "alternative rock", "metal",
    ],
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
    tags: [
      "spanish", "español", "latin", "flamenco", "cumbia", "bolero", "salsa",
      "latin pop", "rock en español", "reggaeton", "reggaetón", "tango", "ranchera",
    ],
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
    tags: [
      "ambient", "chillout", "downtempo", "mellow", "acoustic", "folk",
      "singer-songwriter", "soul", "soft rock", "slowcore", "dream pop",
    ],
    albums: [
      { title: "Continuum", artist: "John Mayer" },
      { title: "Rumours", artist: "Fleetwood Mac" },
    ],
  },
];

export function findRoute(slug: string): ThematicRoute | undefined {
  return THEMATIC_ROUTES.find((r) => r.slug === slug);
}
