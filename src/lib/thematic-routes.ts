// Rutas temáticas (Fase 4, rediseñadas): colecciones REALES del catálogo, no
// listas fijas. Ninguna ruta clava discos a mano; cada una se define por un
// criterio (género por etiquetas, impacto cultural, dificultad de escucha) y se
// llena SOLA con los discos que la IA va fabricando. Una ruta solo se muestra
// cuando tiene suficientes discos de verdad (ver MIN_ALBUMS_RUTA) — nada de
// rutas de relleno "por ponerlas".

export type ThematicRoute = {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  // Criterios (se combinan con Y: un disco entra si cumple TODOS los definidos).
  // Etiquetas del disco (de Last.fm, en factsJson): emparejan por afinidad.
  tags?: string[];
  // Impacto cultural mínimo (1-100). Ruta guiada por datos, siempre real.
  minImpact?: number;
  // Dificultad de escucha (1-5): rangos para "calma" o "máxima atención".
  minDifficulty?: number;
  maxDifficulty?: number;
  // Rango de años (época).
  yearFrom?: number;
  yearTo?: number;
};

/** Una ruta solo aparece en Explorar si reúne al menos esta cantidad de discos
 * reales del catálogo. Así ninguna ruta se siente vacía o "de adorno". */
export const MIN_ALBUMS_RUTA = 3;

export const THEMATIC_ROUTES: ThematicRoute[] = [
  {
    slug: "hitos",
    title: "Hitos que lo cambiaron todo",
    emoji: "🏆",
    description:
      "Los discos de mayor impacto cultural del catálogo: los que movieron la aguja de la música y siguen resonando. La lista se reordena sola cuando llega uno más grande.",
    minImpact: 80,
  },
  {
    slug: "rock-legendario",
    title: "Rock en mayúsculas",
    emoji: "🎸",
    description:
      "Estudio, concepto y estadio. Del clásico al alternativo: discos que definieron lo que significa un álbum completo.",
    tags: [
      "rock", "classic rock", "hard rock", "progressive rock", "psychedelic",
      "psychedelic rock", "rock and roll", "punk", "post-punk", "grunge",
      "alternative rock", "indie rock", "art rock", "metal", "britpop",
    ],
  },
  {
    slug: "jazz-esencial",
    title: "El viaje del jazz",
    emoji: "🎷",
    description:
      "Modal, cool, bop y fusión. La madriguera sin fondo: cada disco abre la puerta al siguiente.",
    tags: [
      "jazz", "bebop", "cool jazz", "hard bop", "modal", "swing", "fusion",
      "jazz fusion", "bossa nova", "free jazz", "big band",
    ],
  },
  {
    slug: "en-espanol",
    title: "En nuestra lengua",
    emoji: "🌹",
    description:
      "Flamenco, bolero, rock en español y pop latino con audacia. Historias que solo suenan como suenan en español.",
    tags: [
      "spanish", "español", "latin", "latin pop", "flamenco", "cumbia", "bolero",
      "salsa", "rock en español", "reggaeton", "reggaetón", "tango", "ranchera",
      "mariachi", "latin alternative", "nueva canción",
    ],
  },
  {
    slug: "groove",
    title: "Hip-hop, soul y groove",
    emoji: "🎤",
    description:
      "El pulso negro de la música moderna: del soul y el funk al rap que lo heredó. Discos que se sienten en el cuerpo.",
    tags: [
      "hip-hop", "hip hop", "rap", "r&b", "rnb", "soul", "neo soul", "neo-soul",
      "funk", "motown", "contemporary r&b", "gangsta rap", "conscious hip hop",
    ],
  },
  {
    slug: "calma",
    title: "Para escuchar con calma",
    emoji: "🌙",
    description:
      "Discos que piden auriculares, un sofá y cero prisa. Acústicos, íntimos, de atardecer.",
    tags: [
      "ambient", "chillout", "downtempo", "mellow", "acoustic", "folk",
      "singer-songwriter", "soft rock", "dream pop", "slowcore", "indie folk",
      "chamber pop",
    ],
  },
  {
    slug: "maxima-atencion",
    title: "A máxima atención",
    emoji: "🧗",
    description:
      "Los más exigentes del catálogo: densos, experimentales, de los que se revelan a la tercera escucha. No de fondo — de sillón y volumen alto.",
    minDifficulty: 4,
  },
];

export function findRoute(slug: string): ThematicRoute | undefined {
  return THEMATIC_ROUTES.find((r) => r.slug === slug);
}
