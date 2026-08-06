// Géneros musicales visibles: derivados EN VIVO de las etiquetas reales de
// Last.fm (factsJson.tags), ya guardadas para cada disco publicado. No hay
// campo nuevo en la base ni backfill que correr: como se calcula al leer, todo
// el catálogo (los discos de siempre y los que la IA fabrique de hoy en
// adelante) queda etiquetado por igual. Sin IA de por medio — determinista,
// así que nunca inventa un género que las etiquetas no respaldan.

type GenreDef = { label: string; tags: string[] };

// Orden = prioridad al desempatar. Los géneros más específicos van primero
// para que "hard bop" caiga en Jazz y no en un cajón genérico.
const GENRES: GenreDef[] = [
  {
    label: "Hip-Hop",
    tags: ["hip-hop", "hip hop", "rap", "trap", "gangsta rap", "conscious hip hop", "boom bap"],
  },
  {
    label: "R&B / Soul",
    tags: ["r&b", "rnb", "soul", "neo soul", "neo-soul", "motown", "contemporary r&b", "funk"],
  },
  {
    label: "Jazz",
    tags: [
      "jazz", "bebop", "cool jazz", "hard bop", "modal", "swing", "fusion",
      "jazz fusion", "bossa nova", "free jazz", "big band",
    ],
  },
  {
    label: "Metal",
    tags: [
      "metal", "heavy metal", "thrash metal", "death metal", "black metal",
      "doom metal", "nu metal", "power metal",
    ],
  },
  {
    label: "Punk",
    tags: ["punk", "post-punk", "hardcore punk", "pop punk", "punk rock"],
  },
  {
    label: "Electrónica",
    tags: [
      "electronic", "electronica", "techno", "house", "edm", "idm",
      "synth-pop", "synthpop", "trance", "drum and bass", "dubstep",
      "downtempo", "disco",
    ],
  },
  {
    label: "Reggae",
    tags: ["reggae", "ska", "dub", "dancehall"],
  },
  {
    label: "Blues",
    tags: ["blues", "blues rock"],
  },
  {
    label: "Country",
    tags: ["country", "americana", "alt-country"],
  },
  {
    label: "Clásica",
    tags: ["classical", "orchestral", "opera", "baroque", "romantic era"],
  },
  {
    label: "Ambient",
    tags: ["ambient", "chillout", "new age", "drone"],
  },
  {
    label: "Folk",
    tags: [
      "folk", "singer-songwriter", "acoustic", "indie folk", "chamber pop",
      "folk rock",
    ],
  },
  {
    label: "Latino",
    tags: [
      "latin", "latin pop", "flamenco", "cumbia", "bolero", "salsa",
      "rock en español", "reggaeton", "reggaetón", "tango", "ranchera",
      "mariachi", "latin alternative", "nueva canción", "spanish", "español",
    ],
  },
  {
    label: "Indie",
    tags: ["indie", "indie rock", "indie pop"],
  },
  {
    label: "Pop",
    tags: ["pop", "dance pop", "britpop", "synth-pop"],
  },
  {
    label: "Rock",
    tags: [
      "rock", "classic rock", "hard rock", "progressive rock",
      "psychedelic rock", "psychedelic", "rock and roll", "grunge",
      "alternative rock", "art rock",
    ],
  },
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagRegex(tag: string): RegExp {
  const esc = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${esc}\\b`);
}

const GENRE_MATCHERS = GENRES.map((g) => ({
  label: g.label,
  regexes: g.tags.map((t) => tagRegex(norm(t))),
}));

/** De las etiquetas crudas de un disco (Last.fm), hasta `max` géneros
 * canónicos para mostrar como badges. Vacío si el disco no tiene etiquetas
 * (p. ej. Last.fm no lo encontró) — nunca inventamos un género de la nada. */
export function deriveGenres(rawTags: string[] | undefined | null, max = 2): string[] {
  if (!rawTags || rawTags.length === 0) return [];
  const normed = rawTags.map(norm);

  const scored = GENRE_MATCHERS.map((g) => ({
    label: g.label,
    hits: normed.filter((t) => g.regexes.some((re) => re.test(t))).length,
  })).filter((g) => g.hits > 0);

  scored.sort((a, b) => b.hits - a.hits);
  return scored.slice(0, max).map((g) => g.label);
}
