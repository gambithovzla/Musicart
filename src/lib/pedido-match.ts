// Leer el pedido del oyente SIN IA.
//
// Por qué existe: el pedido del día ("algo tipo Linkin Park", "rock de los 90",
// "salsa dura") solo se tenía en cuenta cuando hablaba un LLM — al proponer el
// disco fresco o al elegir del catálogo con `elegirConLlm`. El día que la IA no
// contesta (clave vencida, sin saldo, un 429) o se acaba el tope de gasto, la
// app cae a `elegirPorGusto`, que elegía SOLO por afinidad de géneros y no sabía
// nada de lo que el oyente acababa de escribir. Resultado vivido: pides «Linkin
// Park» y te llega un disco de pop español en tres segundos, sin una palabra que
// explique por qué.
//
// Esto no sustituye al curador: es la red de abajo. Compara el texto del pedido
// con lo que sabemos del disco (artista, título, etiquetas, país, década) y
// devuelve una afinidad. Tosco a propósito, pero honesto y siempre disponible.

/** Lo que sabemos de un disco para compararlo con el pedido. */
export type DiscoParaPedido = {
  title: string;
  artist: string;
  year?: number | null;
  tags?: string[];
  /** Código o nombre de país, si consta. */
  country?: string | null;
};

// Palabras que no dicen nada del disco: son el envoltorio de la frase ("hoy
// quiero algo tipo…"). Si no se quitan, cualquier disco "encaja" con el pedido.
const VACIAS = new Set([
  "hoy", "quiero", "quisiera", "dame", "ponme", "pon", "algo", "alguna", "alguno",
  "disco", "discos", "album", "albums", "banda", "grupo", "artista", "artistas",
  "cancion", "canciones", "musica", "escuchar", "oir", "para", "con", "sin",
  "que", "como", "tipo", "estilo", "onda", "vena", "rollo", "parecido", "similar",
  "por", "favor", "una", "uno", "unos", "unas", "del", "las", "los", "des",
  "the", "and", "some", "something", "like", "want", "please", "give",
  "muy", "mas", "menos", "bien", "mejor", "poco", "mucho", "nada", "todo",
  "dia", "noche", "tarde", "mañana", "manana", "ahora", "gusta", "gustan",
  "sea", "ser", "este", "esta", "eso", "esa", "ese", "aqui", "alla",
  "pero", "tambien", "solo", "sino", "aunque", "porque", "cuando",
]);

// Décadas escritas de las tres formas que usa la gente: "80", "80s", "1980",
// "ochenta". El pedido "rock de los 90" tiene que poder mirar el año del disco.
const DECADAS: Record<string, number> = {
  cincuenta: 1950, sesenta: 1960, setenta: 1970, ochenta: 1980, noventa: 1990,
};

/** Palabras con carga del pedido, normalizadas (sin tildes, en minúsculas). */
export function palabrasDelPedido(peticion: string | null | undefined): string[] {
  if (!peticion) return [];
  const limpio = peticion
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  if (!limpio) return [];

  const palabras: string[] = [];
  for (const p of limpio.split(/\s+/)) {
    if (VACIAS.has(p)) continue;
    // Géneros de tres letras que sí importan (rap, pop, ska, dub, r&b→r, b).
    if (p.length < 3 && !/^\d{2}$/.test(p)) continue;
    palabras.push(p);
  }
  return [...new Set(palabras)];
}

/** La década que nombra una palabra del pedido ("90", "1990", "noventa"), o null. */
function decadaDe(palabra: string): number | null {
  if (DECADAS[palabra]) return DECADAS[palabra];
  const soloNumero = palabra.replace(/s$/, "");
  if (/^\d{2}$/.test(soloNumero)) {
    const n = Number(soloNumero);
    // "90" son los noventa; "20" son los 2020 (nadie pide los años 20 del siglo XX).
    return n >= 50 ? 1900 + n : 2000 + n;
  }
  if (/^\d{4}$/.test(soloNumero)) return Math.floor(Number(soloNumero) / 10) * 10;
  return null;
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Cuánto se parece un disco a lo que el oyente pidió, sin preguntarle a nadie.
 * 0 = no hay ni una palabra en común. Cuanto más alto, más cerca del pedido.
 *
 * Los pesos dicen qué manda: el artista y las etiquetas (el género real del
 * disco) valen más que el título, porque un pedido casi siempre habla de sonido
 * o de nombres, no de cómo se llama el disco.
 */
export function afinidadConPedido(
  palabras: string[],
  disco: DiscoParaPedido,
): number {
  if (palabras.length === 0) return 0;

  const artista = normalizar(disco.artist);
  const titulo = normalizar(disco.title);
  const tags = (disco.tags ?? []).map(normalizar);
  const pais = disco.country ? normalizar(disco.country) : "";
  const decadaDisco = disco.year ? Math.floor(disco.year / 10) * 10 : null;

  let afinidad = 0;
  for (const p of palabras) {
    const decada = decadaDe(p);
    if (decada !== null) {
      if (decadaDisco === decada) afinidad += 2;
      continue;
    }
    // Una palabra suma una vez, por su mejor coincidencia: que "rock" salga en
    // el título y en tres etiquetas no lo hace tres veces más rockero.
    if (artista.includes(p)) afinidad += 4;
    else if (tags.some((t) => t.includes(p) || p.includes(t))) afinidad += 3;
    else if (titulo.includes(p)) afinidad += 2;
    else if (pais && pais.includes(p)) afinidad += 2;
  }
  return afinidad;
}

/** ¿Este disco toca AL MENOS una de las palabras del pedido? */
export function tocaElPedido(palabras: string[], disco: DiscoParaPedido): boolean {
  return afinidadConPedido(palabras, disco) > 0;
}
