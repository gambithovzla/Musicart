// Fase 11 — El Atlas: la parte PURA (tipos y etiquetas).
//
// Vive aparte de `atlas.ts` por el mismo motivo que `caminos-pasos.ts` vive
// aparte de `caminos.ts`: la UI de cliente necesita estos tipos, y si los
// importara del motor se traería el pipeline detrás (→ jimp → `fs`) y el build
// se cae. Aquí no hay ni red ni base de datos.

/**
 * Los cinco papeles de un retrato de país. NO son cinco niveles de dificultad
 * (eso es un Camino): son cinco maneras distintas de que un disco cuente algo
 * de un país. Juntos forman un arco — de dónde viene, qué le da orgullo, cómo
 * se cruzó con el mundo, contra qué se levantó y qué suena hoy.
 */
export const PAPELES = ["raiz", "himno", "cruce", "grito", "ahora"] as const;

export type Papel = (typeof PAPELES)[number];

export const DISCOS_POR_RETRATO = PAPELES.length;

/** Lo mínimo que se puede llamar retrato. Menos de tres discos es una anécdota. */
export const MINIMO_PARA_RETRATO = 3;

export const ETIQUETA_PAPEL: Record<Papel, string> = {
  raiz: "La raíz",
  himno: "El himno",
  cruce: "El cruce",
  grito: "El grito",
  ahora: "El ahora",
};

/** Qué se le pide a cada papel. Lo lee el curador y lo lee el oyente. */
export const SENTIDO_PAPEL: Record<Papel, string> = {
  raiz: "De dónde viene todo lo demás: la música que ya sonaba antes del disco.",
  himno: "El que el país reconoce como suyo, el que sale en cualquier conversación.",
  cruce: "Donde su música se encontró con la de fuera y salió algo nuevo.",
  grito: "El que cuenta un momento difícil: lo que se dijo cuando había que decirlo.",
  ahora: "Lo que suena hoy, para que el país no quede como una postal del pasado.",
};

export type OrigenVerificado = "si" | "desconocido";

export type DiscoDelRetrato = {
  orden: number;
  papel: Papel;
  title: string;
  artist: string;
  year: number | null;
  /** Qué cuenta ESTE disco sobre el país. 1-2 frases. */
  porque: string;
  /** Álbum del catálogo si ya tiene dossier; null = hay que fabricarlo. */
  albumId: string | null;
  /**
   * Si pudimos confirmar con datos duros que el artista es de ese país.
   * "desconocido" NO es un error: es lo que se le dice al oyente en vez de
   * fingir seguridad (las tres fuentes de la 7.11 no siempre saben).
   */
  origen: OrigenVerificado;
  /** Qué fuente lo confirmó ("musicbrainz", "wikidata", "wikipedia"). */
  fuente?: string;
};

export type Retrato = {
  code: string;
  /** Nombre del país en español. */
  pais: string;
  titulo: string;
  intro: string | null;
  discos: DiscoDelRetrato[];
  status: "listo" | "vacio";
  /** Si está vacío, por qué. Escrito por el CÓDIGO, nunca por el LLM. */
  nota: string | null;
  actualizado: Date;
};

export function papelValido(x: unknown): x is Papel {
  return typeof x === "string" && (PAPELES as readonly string[]).includes(x);
}
