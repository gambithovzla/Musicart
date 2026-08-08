// Barrera anti-muletilla de la razón del día ("Para ti, hoy").
//
// El problema real que resuelve: el curador se enamora de UN detalle del perfil
// (un interés, una frase de su bio, un disco que amó) y lo repite día tras día
// —"tu amor por las montañas", "tu amor por las montañas"…—. Para el oyente eso
// mata la magia: se le nota la plantilla.
//
// La tarea 7.7 lo intentó SOLO con prompt (pasarle las razones de días recientes
// y prohibirle repetir el gancho). No bastó: el modelo vuelve a la imagen vívida
// aunque se lo prohíbas. Así que aquí va la barrera en código, hermana de las
// que ya existen (`discoCumplePedido`, la anti-repetición de discos):
//
//   1. `ganchosQuemados()` saca de las razones recientes las palabras con carga
//      (sin conectores ni vocabulario musical genérico) que ya usó.
//   2. Esa lista viaja al prompt como prohibición explícita (gratis, sin llamada
//      extra) — la mayoría de los días con eso alcanza.
//   3. `afinarRazon()` revisa la razón YA escrita: si reincide, pide UNA
//      reescritura barata con las palabras vetadas. Si la reescritura falla o
//      empeora, se queda la original — la app nunca se cae por la IA.

import { llm, extractJson } from "./dossier/llm";

const LLM_TIMEOUT_MS = 12_000;

/** Cuántas razones de días previos miramos para detectar la muletilla. */
export const MAX_RAZONES_PREVIAS = 5;

/** Tope de palabras vetadas: las suficientes para cortar la muletilla sin
 *  dejar al curador sin vocabulario. */
const MAX_GANCHOS = 18;

/** Palabras demasiado cortas no distinguen nada ("casa", "vida"). */
const MIN_LARGO = 5;

/** Conectores y muletillas del idioma: repetirlos no es un problema. */
const VACIAS = new Set([
  "porque", "cuando", "donde", "desde", "hasta", "entre", "sobre", "tambien",
  "aunque", "mientras", "siempre", "nunca", "cada", "como", "para", "pero",
  "este", "esta", "estos", "estas", "esos", "esas", "aquel", "aquella",
  "tienes", "tiene", "tienen", "tenias", "hacia", "segun", "todavia", "apenas",
  "ademas", "quizas", "ahora", "antes", "despues", "luego", "mismo", "misma",
  "mismos", "mismas", "otro", "otra", "otros", "otras", "mucho", "mucha",
  "muchos", "muchas", "poco", "poca", "todo", "toda", "todos", "todas",
  "algo", "alguien", "alguna", "algunos", "algunas", "nada", "quiero",
  "quieres", "puede", "puedes", "podria", "podrias", "vamos", "estar",
  "estas", "estoy", "haber", "hacer", "haces", "hecho", "sentir", "sientes",
  "siente", "sientas", "parece", "parecen", "queda", "quedan", "sigue",
  "sigues", "vuelve", "vuelves", "lleva", "llevas", "encuentra", "encuentras",
  "encontrar", "buscas", "buscar", "buscando", "pediste", "dijiste",
  "contaste", "hablaste", "marco", "marcaste", "diste", "hoy", "manana",
  "ayer", "ellos", "ellas", "nosotros", "usted", "aqui", "alli", "aquello",
  "cosas", "manera", "forma", "modo", "vez", "veces", "tanto", "tanta",
  "menos", "mejor", "peor", "bueno", "buena", "gran", "grande", "grandes",
  "pequeno", "pequena", "nuevo", "nueva", "nuevos", "nuevas", "propio",
  "propia", "justo", "justa", "puro", "pura", "sino", "solo", "sola",
  "largo", "larga", "dentro", "traves", "medio", "media", "medida", "lado",
  "punto", "puntos", "parte", "partes", "momento", "momentos", "rato",
  "combina", "combinan", "acompana", "acompanar", "regala", "regalan",
  "convierte", "convierten", "resulta", "resultan", "ofrece", "ofrecen",
]);

/** Vocabulario musical inevitable: que se repita "disco" no es una muletilla,
 *  y vetarlo dejaría al curador sin palabras. Los GÉNEROS también entran aquí:
 *  repetir "rock" con un rockero es correcto, no pereza. */
const MUSICALES = new Set([
  "disco", "discos", "album", "albumes", "musica", "musical", "musicales",
  "cancion", "canciones", "tema", "temas", "sonido", "sonidos", "sonoro",
  "sonora", "sonoros", "sonoras", "escuchar", "escucha", "escuchas",
  "escuchado", "artista", "artistas", "banda", "bandas", "grupo", "grupos",
  "voces", "guitarra", "guitarras", "bateria", "baterias", "piano", "pianos",
  "letra", "letras", "ritmo", "ritmos", "melodia", "melodias", "armonia",
  "armonias", "produccion", "estudio", "estudios", "cancionero", "vinilo",
  "vinilos", "portada", "portadas", "minutos", "duracion", "primera",
  "primer", "ultimo", "ultima", "clasico", "clasica", "clasicos", "clasicas",
  // Géneros y escenas: repetirlos es coherencia con su gusto, no muletilla.
  "rock", "pop", "jazz", "salsa", "hip-hop", "electronica", "indie", "metal",
  "clasica", "folk", "soul", "reggae", "punk", "blues", "cumbia", "bolero",
  "funk", "regueton", "reggaeton", "trap", "bossa", "flamenco", "tango",
  "country", "gospel", "grunge", "britpop", "psicodelia", "psicodelico",
  "psicodelica", "sinfonico", "sinfonica", "acustico", "acustica",
]);

/** Sin tildes, minúsculas: para comparar palabras sin depender de la escritura. */
function sinTildes(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Raíz aproximada: iguala singular y plural ("montañas" ≡ "montaña"). */
function raiz(palabra: string): string {
  const p = sinTildes(palabra);
  if (p.length > 6 && p.endsWith("es")) return p.slice(0, -2);
  if (p.length > 5 && p.endsWith("s")) return p.slice(0, -1);
  return p;
}

/** Palabras con carga de un texto: sin conectores, sin vocabulario musical
 *  genérico, sin números. Devuelve raíz → forma tal como se escribió. */
function palabrasConCarga(texto: string): Map<string, string> {
  const encontradas = new Map<string, string>();
  const crudas = texto.match(/[\p{L}][\p{L}'’-]*/gu) ?? [];
  for (const cruda of crudas) {
    const limpia = cruda.replace(/^[-'’]+|[-'’]+$/g, "");
    if (limpia.length < MIN_LARGO) continue;
    const plana = sinTildes(limpia);
    if (VACIAS.has(plana) || MUSICALES.has(plana)) continue;
    const r = raiz(limpia);
    if (VACIAS.has(r) || MUSICALES.has(r)) continue;
    if (!encontradas.has(r)) encontradas.set(r, limpia.toLowerCase());
  }
  return encontradas;
}

export type Gancho = {
  /** Raíz normalizada (para comparar). */
  raiz: string;
  /** Cómo la escribió el curador (para mostrársela al modelo). */
  forma: string;
  /** En cuántas razones previas apareció. */
  veces: number;
};

/**
 * Ganchos que el curador YA gastó en días recientes y no debería reutilizar hoy.
 *
 * Un gancho "quema" si (a) apareció en la razón más reciente —repetirla al día
 * siguiente es justo lo que el oyente nota— o (b) apareció en dos o más razones
 * (ahí ya es plantilla). Una coincidencia suelta de hace cuatro días no cuenta:
 * no queremos empobrecer el vocabulario del curador sin motivo.
 *
 * @param razones Razones de días previos, de la MÁS NUEVA a la más vieja.
 */
export function ganchosQuemados(
  razones: (string | null | undefined)[],
  max = MAX_GANCHOS,
): Gancho[] {
  const previas = razones
    .filter((r): r is string => Boolean(r && r.trim()))
    .slice(0, MAX_RAZONES_PREVIAS);
  if (previas.length === 0) return [];

  const conteo = new Map<string, { forma: string; veces: number; reciente: boolean }>();
  previas.forEach((razon, i) => {
    for (const [r, forma] of palabrasConCarga(razon)) {
      const actual = conteo.get(r);
      if (actual) {
        actual.veces += 1;
        actual.reciente = actual.reciente || i === 0;
      } else {
        conteo.set(r, { forma, veces: 1, reciente: i === 0 });
      }
    }
  });

  return [...conteo.entries()]
    .filter(([, v]) => v.reciente || v.veces >= 2)
    // Primero lo más repetido; a igualdad, lo de ayer (que es lo que más chirría).
    .sort((a, b) => b[1].veces - a[1].veces || Number(b[1].reciente) - Number(a[1].reciente))
    .slice(0, max)
    .map(([r, v]) => ({ raiz: r, forma: v.forma, veces: v.veces }));
}

/**
 * Ganchos quemados que la razón de hoy volvió a usar. `exentos` son textos cuyo
 * vocabulario está permitido siempre (el título y el artista del disco de hoy:
 * si el disco se llama "Montañas", nombrarlo no es la muletilla).
 */
export function ganchosEnRazon(
  razon: string,
  quemados: Gancho[],
  exentos: string[] = [],
): Gancho[] {
  if (quemados.length === 0 || !razon.trim()) return [];
  const permitidas = new Set<string>();
  for (const texto of exentos) {
    for (const r of palabrasConCarga(texto).keys()) permitidas.add(r);
  }
  const deHoy = new Set(palabrasConCarga(razon).keys());
  return quemados.filter((g) => deHoy.has(g.raiz) && !permitidas.has(g.raiz));
}

/** Bloque para el prompt: las palabras que hoy están vetadas. */
export function textoGanchosProhibidos(quemados: Gancho[]): string {
  if (quemados.length === 0) return "";
  const lista = quemados.map((g) => `"${g.forma}"`).join(", ");
  return `\nPALABRAS E IMÁGENES QUE YA LE DIJISTE ESTOS DÍAS (PROHIBIDO usarlas hoy, ni ellas ni sinónimos suyos, ni la misma idea con otras palabras): ${lista}.
Busca un ángulo NUEVO de su perfil, su diario o su ánimo. Si el único ángulo que se te ocurre está en esa lista, habla del disco de hoy por su propio encanto en vez de repetirte.\n`;
}

/**
 * Reescribe la razón de hoy evitando los ganchos ya gastados. Llamada barata
 * (modelo de runtime) y solo cuando de verdad hubo reincidencia.
 */
async function reescribirRazon(input: {
  title: string;
  artist: string;
  year?: number | null;
  perfilTexto: string;
  mood: string | null;
  voz?: string | null;
  prohibidas: string[];
  razonesPrevias: string[];
  razonOriginal: string;
}): Promise<string | null> {
  const vozCurador = input.voz?.trim()
    ? `${input.voz.trim()} Hablas en español y de "tú".`
    : `Eres cercano y melómano, hablas en español y de "tú".`;

  const system = `Eres el curador musical de Musicart. ${vozCurador}
Tu tarea: reescribir la frase "Para ti, hoy" que acompaña al disco de hoy, porque la versión actual repite un gancho que ya usaste días atrás y suena a plantilla.

Reglas estrictas:
1. Responde SOLO un objeto JSON: {"reason": "..."} — sin texto extra.
2. 1 o 2 frases, cálidas y concretas. Nada de relleno ni de florituras.
3. PROHIBIDO usar estas palabras o su misma idea (aunque las digas de otra forma): ${input.prohibidas.join(", ")}.
4. Cita SOLO señales reales del usuario que aparecen abajo (sus géneros, lo que busca en un disco, su ánimo de hoy, un disco que amó, algo que nos contó). PROHIBIDO inventarle hábitos, actividades, lugares, rutinas o escenas de su vida que no aparezcan literalmente abajo — ni siquiera como imagen "poética".
5. Del disco solo puedes mencionar su título, su artista y su año. PROHIBIDO inventar datos del álbum.
6. Si ninguna señal encaja de verdad con este disco, habla del disco por su propio encanto sin forzar la conexión. Es mejor eso que repetirte.`;

  const previasTexto =
    input.razonesPrevias.length > 0
      ? input.razonesPrevias.map((r) => `- "${r}"`).join("\n")
      : "(ninguna)";

  const user = `DISCO DE HOY: «${input.title}» de ${input.artist}${input.year ? ` (${input.year})` : ""}

PERFIL DEL USUARIO:
${input.perfilTexto}

ÁNIMO DE HOY: ${input.mood ?? "(no indicado)"}

RAZONES QUE YA LE DISTE EN DÍAS RECIENTES (no repitas su ángulo):
${previasTexto}

VERSIÓN ACTUAL (rechazada por repetir el gancho, NO la copies):
"${input.razonOriginal}"

Escribe la razón nueva. Responde el JSON ahora.`;

  try {
    const raw = await llm({
      system,
      user,
      temperature: 0.7,
      maxTokens: 220,
      timeoutMs: LLM_TIMEOUT_MS,
    });
    const texto = extractJson<{ reason?: string }>(raw).reason?.trim();
    return texto && texto.length >= 20 ? texto : null;
  } catch (err) {
    console.warn("[reason-guard] no pude reescribir la razón:", err);
    return null;
  }
}

/**
 * Devuelve la razón del día libre de muletillas. Si la razón recién escrita
 * reincide en un gancho de días recientes, pide una reescritura; si la
 * reescritura falla o repite igual o más, se queda la mejor que tengamos.
 * Nunca lanza: una razón repetida es mucho mejor que una home caída.
 */
export async function afinarRazon(input: {
  razon: string | null;
  razonesPrevias: (string | null | undefined)[];
  title: string;
  artist: string;
  year?: number | null;
  perfilTexto: string;
  mood: string | null;
  voz?: string | null;
}): Promise<string | null> {
  const razon = input.razon?.trim();
  if (!razon) return input.razon;

  try {
    const quemados = ganchosQuemados(input.razonesPrevias);
    const exentos = [input.title, input.artist];
    let mejor = razon;
    let repetidos = ganchosEnRazon(razon, quemados, exentos);
    if (repetidos.length === 0) return razon;

    const previas = input.razonesPrevias
      .filter((r): r is string => Boolean(r && r.trim()))
      .slice(0, 3);

    for (let intento = 0; intento < 2 && repetidos.length > 0; intento++) {
      console.warn(
        `[reason-guard] la razón repite ganchos recientes (${repetidos
          .map((g) => g.forma)
          .join(", ")}); pido reescritura (${intento + 1}/2).`,
      );
      const nueva = await reescribirRazon({
        title: input.title,
        artist: input.artist,
        year: input.year ?? null,
        perfilTexto: input.perfilTexto,
        mood: input.mood,
        voz: input.voz,
        // Vetamos lo que reincidió y, de paso, el resto de lo ya gastado.
        prohibidas: [...new Set([...repetidos, ...quemados].map((g) => g.forma))],
        razonesPrevias: previas,
        razonOriginal: mejor,
      });
      if (!nueva) break;
      const repetidosNuevos = ganchosEnRazon(nueva, quemados, exentos);
      if (repetidosNuevos.length < repetidos.length) {
        mejor = nueva;
        repetidos = repetidosNuevos;
      } else {
        break; // no mejora: nos quedamos con la que ya teníamos
      }
    }

    return mejor;
  } catch (err) {
    console.error("[reason-guard] fallo afinando la razón, dejo la original:", err);
    return razon;
  }
}
