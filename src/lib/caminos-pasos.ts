// Fase 8 — la parte PURA de los caminos: tipos, etiquetas y cálculos sin estado.
//
// Vive separada de `caminos.ts` a propósito: aquella importa el pipeline (y con
// él node-vibrant/jimp, que necesita `fs`), así que un componente de cliente no
// puede importarla sin arrastrar Node al navegador y romper el build. Aquí no
// hay ni una sola importación de servidor: la UI tira de este módulo.

/** Pasos por camino. Cinco es suficiente para contar un arco y corto para
 *  terminarlo; la mayoría de la gente no acaba secuencias más largas. */
export const PASOS_POR_CAMINO = 5;

/** El papel de cada paso dentro del arco. Es lo que hace que un camino se lea
 *  como un recorrido y no como una lista. */
export const PAPELES = ["puerta", "gancho", "canon", "desvio", "cima"] as const;
export type Papel = (typeof PAPELES)[number];

export const PAPEL_ETIQUETA: Record<Papel, string> = {
  puerta: "La puerta",
  gancho: "El gancho",
  canon: "El canon",
  desvio: "El desvío",
  cima: "La cima",
};

export const PAPEL_DESCRIPCION: Record<Papel, string> = {
  puerta: "Por aquí se entra: engancha sin pedirte nada a cambio.",
  gancho: "El que te hace querer más, ya dentro del género.",
  canon: "El que hay que pasar sí o sí para entender de qué va esto.",
  desvio: "Una puerta lateral: el género no es una sola cosa.",
  cima: "El exigente. Llegas con oído para disfrutarlo, no para sufrirlo.",
};

export type CaminoStep = {
  orden: number; // 1..PASOS_POR_CAMINO
  title: string;
  artist: string;
  year: number | null;
  papel: Papel;
  /** Por qué este disco va AQUÍ y qué te deja para el siguiente. El corazón
   *  del feature: cualquiera lista discos, lo valioso es el porqué del orden. */
  puente: string;
  /** Se rellena al fabricar el dossier. Solo si quedó PUBLICADO: un dossier en
   *  borrador da 404 al oyente, así que el albumId de un borrador sería un
   *  enlace roto. */
  albumId: string | null;
  /** ISO. Marcarlo abre el siguiente paso. */
  escuchadoAt: string | null;
};

/** Un paso está ABIERTO si es el primero o si el anterior ya se escuchó. */
export function pasoAbierto(pasos: CaminoStep[], indice: number): boolean {
  if (indice === 0) return true;
  return Boolean(pasos[indice - 1]?.escuchadoAt);
}

/** En qué paso va el oyente (1-based): el primero sin escuchar. */
export function pasoActual(pasos: CaminoStep[]): number {
  const i = pasos.findIndex((p) => !p.escuchadoAt);
  return i === -1 ? pasos.length : i + 1;
}

export function papelValido(papel: string | undefined, orden: number): Papel {
  const p = (papel ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if ((PAPELES as readonly string[]).includes(p)) return p as Papel;
  return PAPELES[Math.min(orden - 1, PAPELES.length - 1)];
}
