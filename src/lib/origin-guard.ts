// Fase 7.9 — Barrera dura del ORIGEN del artista.
//
// Por qué existe: cuando el oyente pide "artistas venezolanos, rock", los
// prompts solo trataban como obligatorios el género, el idioma, la época, el
// estilo y la energía. El país no estaba en ninguna lista, así que el curador
// cumplía la mitad del pedido (rock) y se saltaba la otra mitad (venezolanos):
// Green Day, Van Halen… El verificador de pedido (`discoCumplePedido`) tampoco
// lo cazaba, porque juzgaba "¿es rock?" y decía que sí.
//
// La lección de la 7.8 aplica igual aquí: lo que importa de verdad no se deja
// solo en manos del prompt. Esta barrera es de CÓDIGO y con DATOS DUROS: si el
// pedido nombra un país o una nacionalidad, miramos en MusicBrainz de dónde es
// el artista propuesto y, si no coincide, lo rechazamos antes de gastar el
// pipeline. Hermana de `reason-guard.ts` y de `discoCumplePedido`.
//
// Filosofía de las dudas: solo cortamos los desajustes CLAROS (MusicBrainz dice
// que es de otro país). Si no encontramos al artista o no hay dato de origen,
// dejamos pasar — nunca dejamos al oyente sin disco por un fallo de la fuente.

import { searchArtistOrigin } from "./sources/musicbrainz";

export type PaisPedido = {
  /** Código ISO que usa MusicBrainz (VE, US, GB…). */
  code: string;
  /** Nombre en español, para explicárselo al LLM y al log. */
  nombre: string;
};

type Entrada = {
  code: string;
  nombre: string;
  /** Raíces (sin acentos) que delatan el país: admiten sufijos (-o/-a/-os/-as). */
  claves: string[];
  /** El gentilicio también nombra un IDIOMA ("en inglés" no es un pedido de país). */
  ambiguo?: boolean;
  /** Nombres de área en MusicBrainz (inglés y español) para el respaldo. */
  areas: string[];
};

// Diccionario de países musicalmente relevantes. No pretende ser exhaustivo:
// cubre toda Hispanoamérica (donde más se pide "artistas de mi país") y las
// escenas grandes. Lo que no está aquí simplemente no activa la barrera.
const PAISES: Entrada[] = [
  { code: "VE", nombre: "Venezuela", claves: ["venezuela", "venezolan"], areas: ["venezuela"] },
  { code: "AR", nombre: "Argentina", claves: ["argentina", "argentin"], areas: ["argentina"] },
  { code: "MX", nombre: "México", claves: ["mexico", "mejico", "mexican"], areas: ["mexico"] },
  { code: "CO", nombre: "Colombia", claves: ["colombia", "colombian"], areas: ["colombia"] },
  { code: "CL", nombre: "Chile", claves: ["chile", "chilen"], areas: ["chile"] },
  { code: "PE", nombre: "Perú", claves: ["peru", "peruan"], areas: ["peru"] },
  { code: "CU", nombre: "Cuba", claves: ["cuba", "cuban"], areas: ["cuba"] },
  {
    code: "PR",
    nombre: "Puerto Rico",
    claves: ["puerto rico", "puertorriquen", "boricua"],
    areas: ["puerto rico"],
  },
  { code: "DO", nombre: "República Dominicana", claves: ["dominican"], areas: ["dominican republic"] },
  { code: "UY", nombre: "Uruguay", claves: ["uruguay", "uruguay"], areas: ["uruguay"] },
  { code: "PY", nombre: "Paraguay", claves: ["paraguay"], areas: ["paraguay"] },
  { code: "BO", nombre: "Bolivia", claves: ["bolivia", "bolivian"], areas: ["bolivia"] },
  { code: "EC", nombre: "Ecuador", claves: ["ecuador", "ecuatorian"], areas: ["ecuador"] },
  { code: "CR", nombre: "Costa Rica", claves: ["costa rica", "costarricense"], areas: ["costa rica"] },
  { code: "PA", nombre: "Panamá", claves: ["panama", "panamen"], areas: ["panama"] },
  { code: "GT", nombre: "Guatemala", claves: ["guatemala", "guatemaltec"], areas: ["guatemala"] },
  { code: "HN", nombre: "Honduras", claves: ["honduras", "hondur"], areas: ["honduras"] },
  { code: "SV", nombre: "El Salvador", claves: ["salvador", "salvadoren"], areas: ["el salvador"] },
  { code: "NI", nombre: "Nicaragua", claves: ["nicaragua", "nicaraguen"], areas: ["nicaragua"] },
  {
    code: "ES",
    nombre: "España",
    claves: ["espana", "espanol"],
    ambiguo: true, // "en español" es idioma, no país
    areas: ["spain", "espana"],
  },
  {
    code: "US",
    nombre: "Estados Unidos",
    claves: ["estados unidos", "estadounidense", "norteamerican", "gringo", "eeuu"],
    areas: ["united states"],
  },
  {
    code: "GB",
    nombre: "Reino Unido",
    claves: ["reino unido", "britanic", "ingles", "inglaterra", "escoces", "escocia", "gales"],
    ambiguo: true, // "en inglés" es idioma, no país
    areas: ["united kingdom", "england", "scotland", "wales", "northern ireland"],
  },
  { code: "IE", nombre: "Irlanda", claves: ["irlanda", "irlandes"], areas: ["ireland"] },
  { code: "CA", nombre: "Canadá", claves: ["canada", "canadiense"], areas: ["canada"] },
  { code: "BR", nombre: "Brasil", claves: ["brasil", "brasilen", "brasiler"], areas: ["brazil", "brasil"] },
  {
    code: "PT",
    nombre: "Portugal",
    claves: ["portugal", "portugues"],
    ambiguo: true,
    areas: ["portugal"],
  },
  {
    code: "FR",
    nombre: "Francia",
    claves: ["francia", "frances"],
    ambiguo: true,
    areas: ["france"],
  },
  {
    code: "IT",
    nombre: "Italia",
    claves: ["italia", "italian"],
    ambiguo: true,
    areas: ["italy", "italia"],
  },
  {
    code: "DE",
    nombre: "Alemania",
    claves: ["alemania", "aleman"],
    ambiguo: true,
    areas: ["germany"],
  },
  { code: "NL", nombre: "Países Bajos", claves: ["holanda", "holandes", "neerlandes", "paises bajos"], areas: ["netherlands"] },
  { code: "BE", nombre: "Bélgica", claves: ["belgica", "belga"], areas: ["belgium"] },
  { code: "SE", nombre: "Suecia", claves: ["suecia", "sueco"], areas: ["sweden"] },
  { code: "NO", nombre: "Noruega", claves: ["noruega", "noruego"], areas: ["norway"] },
  { code: "DK", nombre: "Dinamarca", claves: ["dinamarca", "danes"], areas: ["denmark"] },
  { code: "FI", nombre: "Finlandia", claves: ["finlandia", "finlandes"], areas: ["finland"] },
  { code: "IS", nombre: "Islandia", claves: ["islandia", "islandes"], areas: ["iceland"] },
  { code: "PL", nombre: "Polonia", claves: ["polonia", "polaco"], areas: ["poland"] },
  { code: "GR", nombre: "Grecia", claves: ["grecia", "griego"], ambiguo: true, areas: ["greece"] },
  { code: "RU", nombre: "Rusia", claves: ["rusia", "ruso"], ambiguo: true, areas: ["russia"] },
  { code: "AU", nombre: "Australia", claves: ["australia", "australian"], areas: ["australia"] },
  { code: "NZ", nombre: "Nueva Zelanda", claves: ["nueva zelanda", "neozelandes"], areas: ["new zealand"] },
  { code: "JM", nombre: "Jamaica", claves: ["jamaica", "jamaiquin", "jamaican"], areas: ["jamaica"] },
  { code: "NG", nombre: "Nigeria", claves: ["nigeria", "nigerian"], areas: ["nigeria"] },
  { code: "ZA", nombre: "Sudáfrica", claves: ["sudafrica", "sudafrican"], areas: ["south africa"] },
  { code: "SN", nombre: "Senegal", claves: ["senegal", "senegales"], areas: ["senegal"] },
  { code: "ML", nombre: "Malí", claves: ["mali", "maliense"], areas: ["mali"] },
  { code: "EG", nombre: "Egipto", claves: ["egipto", "egipcio"], areas: ["egypt"] },
  { code: "MA", nombre: "Marruecos", claves: ["marruecos", "marroqui"], areas: ["morocco"] },
  { code: "IL", nombre: "Israel", claves: ["israel", "israeli"], areas: ["israel"] },
  { code: "TR", nombre: "Turquía", claves: ["turquia", "turco"], ambiguo: true, areas: ["turkey"] },
  { code: "IN", nombre: "India", claves: ["india", "indio", "hindu"], areas: ["india"] },
  { code: "JP", nombre: "Japón", claves: ["japon", "japones"], ambiguo: true, areas: ["japan"] },
  { code: "KR", nombre: "Corea del Sur", claves: ["corea", "coreano"], ambiguo: true, areas: ["south korea", "korea"] },
  { code: "CN", nombre: "China", claves: ["china", "chino"], ambiguo: true, areas: ["china"] },
];

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Palabras que, delante del gentilicio, delatan que hablaba del IDIOMA y no del
// país ("cantado en inglés", "en italiano"). Solo aplica a los ambiguos.
const ANTES_DE_IDIOMA = /(?:^|\s)(en|idioma|lengua|cantad[oa]s?\s+en)\s+$/;

/**
 * ¿El pedido del oyente nombra un país o una nacionalidad? Devuelve todos los
 * que encuentre (pedir "argentinos o uruguayos" es legítimo). Lista vacía = el
 * pedido no habla de origen y la barrera no se activa.
 */
export function detectarPaisesPedido(peticion: string | null | undefined): PaisPedido[] {
  const texto = normalizar(peticion ?? "");
  if (!texto) return [];

  const encontrados: PaisPedido[] = [];
  for (const p of PAISES) {
    for (const clave of p.claves) {
      // Raíz + cualquier sufijo (venezolan → venezolano/a/os/as), en frontera de palabra.
      const re = new RegExp(`(?:^|\\s)${clave}[a-z]*(?=\\s|$)`, "g");
      let m: RegExpExecArray | null;
      let acierto = false;
      while ((m = re.exec(texto)) !== null) {
        if (p.ambiguo && ANTES_DE_IDIOMA.test(texto.slice(0, m.index + 1))) continue;
        acierto = true;
        break;
      }
      if (acierto) {
        encontrados.push({ code: p.code, nombre: p.nombre });
        break;
      }
    }
    if (encontrados.length >= 3) break; // tope sensato
  }
  return encontrados;
}

/** Nombre en español de un código ISO conocido (para explicar el rechazo). */
function nombreDePais(code: string | null): string | null {
  if (!code) return null;
  return PAISES.find((p) => p.code === code)?.nombre ?? code;
}

/** ¿Ese nombre de área (MusicBrainz, en inglés) es de alguno de los países? */
function codePorArea(area: string | null): string | null {
  if (!area) return null;
  const a = normalizar(area);
  return PAISES.find((p) => p.areas.includes(a))?.code ?? null;
}

export type VeredictoOrigen = {
  /** "no" solo cuando MusicBrainz dice claramente que es de otro país. */
  veredicto: "si" | "no" | "desconocido";
  /** De dónde resultó ser, para el log y para explicarle el rechazo al LLM. */
  origen: string | null;
};

// Caché por proceso: en una fabricación se proponen varios discos y algunos
// artistas se repiten entre intentos. MusicBrainz va a 1 req/s, así que no
// preguntamos dos veces por el mismo nombre.
const cache = new Map<string, VeredictoOrigen>();

/**
 * ¿El artista es de alguno de los países pedidos? Datos de MusicBrainz.
 * Ante cualquier duda (artista no encontrado, sin dato de origen, fuente caída)
 * devuelve "desconocido" y quien llama deja pasar: preferimos un disco de más
 * que dejar al oyente sin disco.
 */
export async function artistaEsDeAlgunPais(
  artist: string,
  paises: PaisPedido[],
): Promise<VeredictoOrigen> {
  if (paises.length === 0) return { veredicto: "desconocido", origen: null };
  const clave = normalizar(artist);
  if (!clave) return { veredicto: "desconocido", origen: null };

  const cacheKey = `${clave}|${paises.map((p) => p.code).sort().join(",")}`;
  const enCache = cache.get(cacheKey);
  if (enCache) return enCache;

  let resultado: VeredictoOrigen = { veredicto: "desconocido", origen: null };
  try {
    const origen = await searchArtistOrigin(artist);
    if (origen) {
      const buscados = new Set(paises.map((p) => p.code));
      // El país declarado manda; si falta, probamos con el área de origen y la actual.
      const code =
        origen.country ??
        codePorArea(origen.beginAreaName) ??
        codePorArea(origen.areaName);
      if (code && buscados.has(code)) {
        resultado = { veredicto: "si", origen: nombreDePais(code) };
      } else if (code) {
        resultado = { veredicto: "no", origen: nombreDePais(code) };
      } else {
        // Sin país reconocible: no bloqueamos (puede ser un área rara o un
        // artista que MusicBrainz tiene a medias).
        resultado = {
          veredicto: "desconocido",
          origen: origen.beginAreaName ?? origen.areaName ?? null,
        };
      }
    }
  } catch (err) {
    console.warn("[origin-guard] no pude comprobar el origen del artista:", err);
    return { veredicto: "desconocido", origen: null };
  }

  cache.set(cacheKey, resultado);
  return resultado;
}

/** Texto para el prompt: "artistas de Venezuela" / "de Argentina o Uruguay". */
export function nombresDePaises(paises: PaisPedido[]): string {
  const nombres = paises.map((p) => p.nombre);
  if (nombres.length <= 1) return nombres[0] ?? "";
  return `${nombres.slice(0, -1).join(", ")} o ${nombres[nombres.length - 1]}`;
}
