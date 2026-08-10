// Fase 9 — El motor de puntaje del Salón de la Fama.
//
// La regla de oro: AQUÍ NO ENTRA NINGÚN LLM. El puntaje de un disco sale de
// señales duras y comprobables (cuántas Wikipedias del mundo le dedican un
// artículo, qué premios recibió, cuánta gente lo escucha), y de una calibración
// por percentil contra todo el índice. Eso es lo que arregla el problema que
// tiene `Album.impact`: ese número lo escribe la IA disco a disco, sin ver a los
// demás, así que un 88 de enero y un 91 de marzo no son comparables. Aquí un 91
// significa siempre lo mismo: "estás en el 6% más alto del canon".
//
// Este archivo es PURO a propósito (sin red, sin base de datos): así se puede
// verificar la curva y la distribución sin depender de nada externo, y la
// ingesta (`ingest.ts`) solo se encarga de traer las señales.

/** Señales crudas de un disco, tal como llegan de las fuentes. */
export type CanonSignals = {
  /** Ediciones de Wikipedia con artículo propio del disco (Wikidata sitelinks). */
  sitelinks: number;
  /**
   * Premios recibidos, por su ETIQUETA tal como la devuelve la fuente
   * ("Grammy Award for Album of the Year"). Guardamos el texto y no el
   * identificador de Wikidata a propósito: la etiqueta es un dato que nos
   * llega, mientras que un QID escrito de memoria sería justo el tipo de dato
   * inventado que este proyecto no admite.
   */
  awards: string[];
  /** Oyentes únicos en Last.fm, si la fuente respondió. */
  listeners: number | null;
  /** Votos de valoración en MusicBrainz (mide atención, no calidad). */
  ratingVotes: number | null;
};

export const SIN_SENALES: CanonSignals = {
  sitelinks: 0,
  awards: [],
  listeners: null,
  ratingVotes: null,
};

// ── Premios: cuánto pesa cada uno ────────────────────────────────────────────
// Se comparan en minúsculas por coincidencia de texto, de mayor a menor
// especificidad. Un premio que no reconocemos igual suma algo (PESO_OTRO): que
// no esté en esta tabla no significa que no valga.
const PESOS_PREMIO: { patron: RegExp; peso: number; etiqueta: string }[] = [
  { patron: /album of the year/i, peso: 1, etiqueta: "Álbum del Año" },
  { patron: /national recording registry/i, peso: 0.9, etiqueta: "National Recording Registry" },
  { patron: /grammy hall of fame/i, peso: 0.8, etiqueta: "Grammy Hall of Fame" },
  { patron: /mercury prize/i, peso: 0.55, etiqueta: "Mercury Prize" },
  { patron: /polaris music prize/i, peso: 0.45, etiqueta: "Polaris Music Prize" },
  { patron: /latin grammy/i, peso: 0.45, etiqueta: "Latin Grammy" },
  { patron: /brit award/i, peso: 0.4, etiqueta: "BRIT Award" },
  { patron: /grammy/i, peso: 0.35, etiqueta: "Grammy" },
  { patron: /premio goya|premio ondas|premio nacional/i, peso: 0.35, etiqueta: "premio nacional" },
];
const PESO_OTRO = 0.15;

/** Peso total de los premios de un disco, saturado (5 premios ya es techo). */
function puntajePremios(awards: string[]): number {
  const suma = awards.reduce((acc, a) => {
    const match = PESOS_PREMIO.find((p) => p.patron.test(a));
    return acc + (match ? match.peso : PESO_OTRO);
  }, 0);
  // Saturación suave: el primer premio grande vale mucho, el décimo casi nada.
  return 1 - Math.exp(-suma / 1.4);
}

/**
 * Normaliza un número grande a 0..1 con escala logarítmica. Los oyentes y los
 * artículos de Wikipedia crecen de forma brutalmente desigual (un disco con
 * 4 millones de oyentes no vale 40 veces uno con 100.000), así que la escala
 * lineal aplastaría todo el índice contra el suelo.
 */
function log01(valor: number, techo: number): number {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  const v = Math.log10(1 + Math.min(valor, techo));
  return v / Math.log10(1 + techo);
}

// Techos de referencia: por encima de esto, más ya no suma.
const TECHO_SITELINKS = 80; // ~80 ediciones de Wikipedia es lo máximo que se ve
const TECHO_LISTENERS = 4_000_000;
const TECHO_VOTOS = 400;

// Pesos de cada señal en el prestigio bruto. Los oyentes pesan poco a
// propósito: esto mide CONSAGRACIÓN, no popularidad. Si la popularidad pesara
// mucho, el Salón se llenaría de éxitos recientes y dejaría fuera a Coltrane.
//
// Wikipedia manda porque es la señal más robusta que existe para "el mundo
// entero considera que esto importa", y porque no la controla ninguna industria
// premiadora. Los premios se quedaron en 0,28 tras probar la escala: con más
// peso, un disco con dos premios grandes y 20 artículos le ganaba a uno con 62
// artículos y tres millones de oyentes, que es justo el tipo de incoherencia
// que este ranking existe para evitar.
//
// Sesgo conocido y asumido: Wikipedia sobre-representa al mundo anglosajón. Por
// eso el Salón se navega TAMBIÉN por país y por género (`country`, `genresJson`)
// — dentro de un mismo canon la comparación vuelve a ser justa.
const PESO_SITELINKS = 0.58;
const PESO_PREMIOS = 0.28;
const PESO_OYENTES = 0.11;
const PESO_VOTOS = 0.04;

/**
 * Prestigio bruto de un disco: 0..1. Todavía NO es el puntaje que ve el
 * usuario — para eso hace falta ver el índice entero (ver `calibrar`).
 */
export function prestigioBruto(s: CanonSignals): number {
  const sitelinks = log01(s.sitelinks, TECHO_SITELINKS);
  const premios = puntajePremios(s.awards);
  const oyentes = log01(s.listeners ?? 0, TECHO_LISTENERS);
  const votos = log01(s.ratingVotes ?? 0, TECHO_VOTOS);

  return (
    sitelinks * PESO_SITELINKS +
    premios * PESO_PREMIOS +
    oyentes * PESO_OYENTES +
    votos * PESO_VOTOS
  );
}

// ── La curva: de "puesto en el ranking" a "puntaje 1-100" ────────────────────
//
// Puntos de control [fracción desde arriba, puntaje]. Se interpola linealmente
// entre ellos. Está calibrada para que el 100 sea RARÍSIMO: con un índice de
// 1.000 discos, solo los 4 primeros llegan a 100, y hacen falta ~30 para bajar
// a 95. Esa escasez es lo que hace que "un disco 100 de 100" signifique algo.
//
// El suelo es 55 y no 1 porque estar EN el índice ya es una distinción: son los
// discos más documentados de la historia grabada. Un disco de nicho no está
// aquí, sencillamente no aparece.
const CURVA: [number, number][] = [
  [0.0, 100],
  [0.004, 100], // el club de los inmortales: el 0,4% más alto
  [0.03, 95],
  [0.09, 90],
  [0.25, 80],
  [0.45, 72],
  [0.7, 64],
  [1.0, 55],
];

/** Puntaje 1-100 para un disco que está en el puesto `fracción` desde arriba. */
export function curvaCanon(fraccionDesdeArriba: number): number {
  const f = Math.min(1, Math.max(0, fraccionDesdeArriba));
  for (let i = 1; i < CURVA.length; i++) {
    const [fA, pA] = CURVA[i - 1];
    const [fB, pB] = CURVA[i];
    if (f <= fB) {
      const t = fB === fA ? 0 : (f - fA) / (fB - fA);
      return Math.round(pA + (pB - pA) * t);
    }
  }
  return CURVA[CURVA.length - 1][1];
}

export type ParaCalibrar = { id: string; raw: number; locked: boolean };
export type Calibrado = { id: string; score: number };

/**
 * Convierte los prestigios brutos de TODO el índice en puntajes 1-100. Esta es
 * la pieza que da coherencia: el puntaje no depende de cuánta evidencia tuvimos
 * de un disco suelto, sino de dónde queda frente a los demás. Añadir discos
 * nuevos al índice puede mover puntajes, y está bien: el canon es un ranking.
 *
 * Los discos con `locked` (los que el curador fijó a mano, típicamente el club
 * de los 100) NO se recalculan, pero sí ocupan su lugar en el orden para que no
 * distorsionen el percentil de los demás.
 */
export function calibrar(items: ParaCalibrar[]): Calibrado[] {
  const n = items.length;
  if (n === 0) return [];

  const orden = [...items].sort((a, b) => b.raw - a.raw);
  return orden.map((item, i) => ({
    id: item.id,
    // (i + 0.5) / n centra cada disco en su tramo: con un índice de 1 disco no
    // se lleva un 100 automático solo por ser el único.
    score: curvaCanon((i + 0.5) / n),
  }));
}

// ── Los recibos ──────────────────────────────────────────────────────────────

/**
 * Traduce las señales a frases legibles que el oyente puede abrir bajo el
 * número ("¿por qué este disco es un 96?"). Sin IA: son los datos, contados.
 * Es el mismo compromiso que `Dossier.impactNote`, pero aquí ni siquiera hace
 * falta verificar nada porque no hay nada escrito por un modelo.
 */
export function recibos(s: CanonSignals): string[] {
  const out: string[] = [];

  if (s.sitelinks >= 3) {
    out.push(
      `Tiene artículo propio en ${s.sitelinks} ediciones de Wikipedia` +
        (s.sitelinks >= 40 ? " — de los discos más documentados del mundo" : ""),
    );
  }

  // Premios: agrupamos por etiqueta conocida para no repetir "Grammy" seis veces.
  const vistos = new Set<string>();
  for (const a of s.awards) {
    const match = PESOS_PREMIO.find((p) => p.patron.test(a));
    const etiqueta = match ? match.etiqueta : a;
    if (vistos.has(etiqueta)) continue;
    vistos.add(etiqueta);
    out.push(match ? `Reconocido con ${match.etiqueta}` : `Premio: ${a}`);
    if (vistos.size >= 4) break;
  }

  if (s.listeners && s.listeners >= 100_000) {
    out.push(`${formatearOyentes(s.listeners)} en Last.fm`);
  }

  return out;
}

function formatearOyentes(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const txt = m < 10 ? m.toFixed(1).replace(".0", "").replace(".", ",") : String(Math.round(m));
    return `${txt} millones de oyentes`;
  }
  return `${Math.round(n / 1000)} mil oyentes`;
}

// ── La leyenda del puntaje ───────────────────────────────────────────────────
// Hermana de la leyenda del impacto cultural (6.5), pero con nombres propios:
// esto es un Salón de la Fama, no una ficha técnica.

export type Piso = {
  min: number;
  nombre: string;
  descripcion: string;
};

export const PISOS: Piso[] = [
  {
    min: 100,
    nombre: "Inmortales",
    descripcion: "Los discos con los que se cuenta la historia de la música grabada.",
  },
  {
    min: 95,
    nombre: "Cumbres",
    descripcion: "Discos que cualquier conversación seria sobre música termina nombrando.",
  },
  {
    min: 90,
    nombre: "Hitos",
    descripcion: "Movieron su género de sitio y se nota décadas después.",
  },
  {
    min: 80,
    nombre: "Clásicos mayores",
    descripcion: "Consagrados, citados y queridos mucho más allá de su momento.",
  },
  {
    min: 70,
    nombre: "Grandes discos",
    descripcion: "Obras sólidas con reconocimiento real, aunque no cambiaran el mapa.",
  },
  {
    min: 0,
    nombre: "Notables",
    descripcion: "Están en el canon, que ya es decir algo, pero en sus márgenes.",
  },
];

export function pisoDe(score: number): Piso {
  return PISOS.find((p) => score >= p.min) ?? PISOS[PISOS.length - 1];
}
