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
// pedido nombra un país o una nacionalidad, miramos de dónde es el artista
// propuesto y, si no coincide, lo rechazamos antes de gastar el pipeline.
// Hermana de `reason-guard.ts` y de `discoCumplePedido`.
//
// ── TRES FUENTES, no una (ago 2026) ──────────────────────────────────────────
// Nació mirando solo a MusicBrainz, y ahí tenía un agujero justo donde más
// duele: MusicBrainz es magnífico con el canon anglosajón y flojo con los
// artistas de nicho de países pequeños — que son EXACTAMENTE los que se piden
// cuando alguien escribe "quiero algo de mi país". Con esos, la barrera decía
// "no lo sé" y no comprobaba nada; peor aún, el oyente recibía el aviso de
// "no pude confirmar que sea de Venezuela" casi siempre, que es la manera más
// rápida de que un aviso honesto se vuelva ruido y se deje de leer.
//
// Ahora se pregunta en cadena, de la fuente más fiable a la menos:
//   1. MusicBrainz — dato estructurado y curado a mano. Manda si contesta.
//   2. Wikidata — dato igual de estructurado (un código ISO), CC0 y con mucha
//      mejor cobertura fuera del mundo anglosajón: si el artista tiene artículo
//      en la Wikipedia en español, casi seguro está aquí.
//   3. Wikipedia — la primera frase del artículo ("es una banda venezolana
//      de..."). Es texto libre, así que se lee con pinzas: solo cuenta si
//      nombra UN país y solo uno. Es la última red, y para los artistas más
//      oscuros suele ser la única que sabe algo.
// La primera que dé un veredicto claro gana; ninguna se consulta si la anterior
// ya respondió. Y todas las dudas siguen resolviéndose igual que siempre: sin
// dato, "desconocido", y quien llama decide.
//
// Filosofía de las dudas: solo cortamos los desajustes CLAROS (MusicBrainz dice
// que es de otro país). Si no encontramos al artista o no hay dato de origen,
// dejamos pasar — nunca dejamos al oyente sin disco por un fallo de la fuente.

import { searchArtistOrigin } from "./sources/musicbrainz";
import { PAISES, nombreDePais } from "./paises";
import { origenDeArtista } from "./sources/wikidata";
import { getArtistIntro, firstFactSentence } from "./sources/wikipedia";

export type PaisPedido = {
  /** Código ISO que usa MusicBrainz (VE, US, GB…). */
  code: string;
  /** Nombre en español, para explicárselo al LLM y al log. */
  nombre: string;
};

// La tabla de países se mudó a `paises.ts` (Fase 11): el Atlas necesitaba el
// mundo entero ordenado por regiones, y tener dos listas de países en el mismo
// repo era pedir que se desincronizaran. Aquí solo queda lo que esta barrera
// sabe hacer: leer un pedido y comprobar un origen.

/** Lo que se le permite crecer a una raíz: -o, -a, -os, -as, -es, -ses… */
const SUFIJO_GENTILICIO = "[a-z]{0,3}";

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
      // Raíz + el sufijo de un gentilicio, en frontera de palabra: venezolan →
      // venezolano/a/os/as, senegales → senegaleses. El tope de TRES letras no
      // es cosmético: con la tabla del mundo entero (Fase 11) hay raíces cortas
      // como "mali", y con sufijo libre "malísimo" pedía discos de Malí.
      const re = new RegExp(`(?:^|\\s)${clave}${SUFIJO_GENTILICIO}(?=\\s|$)`, "g");
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

/**
 * Quita del pedido las palabras que nombran el país ("venezolano", "Venezuela").
 * Lo que queda es lo que describe el SONIDO ("rock", "de los 90"), que es lo
 * único que sirve para buscar por género: pedirle a MusicBrainz artistas con la
 * etiqueta "venezolano" no devuelve nada.
 */
export function quitarPalabrasDePais(palabras: string[]): string[] {
  const raices = PAISES.flatMap((p) => p.claves.flatMap((c) => c.split(" ")));
  return palabras.filter((palabra) => {
    const p = normalizar(palabra);
    return !raices.some((raiz) => p.startsWith(raiz));
  });
}

/**
 * Índice de nombre de área → código, construido una sola vez.
 *
 * MusicBrainz nombra las áreas en inglés, así que además de las que la tabla
 * declara a mano (Reino Unido → england, scotland…) se meten el nombre inglés
 * del país y el español. Con 190 países, buscar recorriendo la lista en cada
 * comprobación era trabajo repetido para nada.
 */
const POR_AREA: Map<string, string> = (() => {
  const mapa = new Map<string, string>();
  let enIngles: Intl.DisplayNames | null = null;
  try {
    enIngles = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    enIngles = null;
  }
  for (const p of PAISES) {
    const nombres = [...(p.areas ?? []), p.nombre, enIngles?.of(p.code) ?? ""];
    for (const n of nombres) {
      const clave = normalizar(n);
      // El primero que reclama un nombre se lo queda: la tabla manda sobre el
      // catálogo del idioma.
      if (clave && !mapa.has(clave)) mapa.set(clave, p.code);
    }
  }
  return mapa;
})();

/** El nombre del país en inglés, normalizado. "" si el runtime no lo sabe. */
function nombreEnIngles(code: string): string {
  try {
    return normalizar(new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? "");
  } catch {
    return "";
  }
}

/** ¿Ese nombre de área (MusicBrainz, en inglés) es de alguno de los países? */
function codePorArea(area: string | null): string | null {
  if (!area) return null;
  return POR_AREA.get(normalizar(area)) ?? null;
}

export type FuenteOrigen = "musicbrainz" | "wikidata" | "wikipedia";

export type VeredictoOrigen = {
  /** "no" solo cuando alguna fuente dice claramente que es de otro país. */
  veredicto: "si" | "no" | "desconocido";
  /** De dónde resultó ser, para el log y para explicarle el rechazo al LLM. */
  origen: string | null;
  /** Quién lo dijo. Sirve para el log y para saber cuánto fiarse. */
  fuente?: FuenteOrigen;
};

const NO_LO_SE: VeredictoOrigen = { veredicto: "desconocido", origen: null };

// Caché por proceso: en una fabricación se proponen varios discos y algunos
// artistas se repiten entre intentos. MusicBrainz va a 1 req/s, así que no
// preguntamos dos veces por el mismo nombre.
const cache = new Map<string, VeredictoOrigen>();

/**
 * Cuánto tiempo, como mucho, se le dedica a las fuentes de respaldo.
 *
 * Buscar en más sitios no puede significar hacer esperar más al oyente: esto se
 * pregunta mientras se fabrica su disco. MusicBrainz ya se toma lo suyo (va a
 * una petición por segundo), así que Wikidata y Wikipedia juegan con reloj: si
 * no contestan a tiempo, "no lo sé" y seguimos.
 */
const TOPE_RESPALDO_MS = 6_000;

/** La promesa, o `null` si tarda más de la cuenta. Nunca lanza. */
async function conTope<T>(promesa: Promise<T>, ms: number): Promise<T | null> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promesa,
      new Promise<null>((resolve) => {
        reloj = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (reloj) clearTimeout(reloj);
  }
}

/** El veredicto que sale de comparar unos códigos con lo que se pidió. */
function veredictoPorCodigos(
  codigos: string[],
  buscados: Set<string>,
  fuente: FuenteOrigen,
): VeredictoOrigen {
  if (codigos.length === 0) return NO_LO_SE;
  // Con doble nacionalidad basta con que UNA encaje: un franco-maliense es
  // maliense, y decirle que no al oyente sería mezquino además de falso.
  const acierto = codigos.find((c) => buscados.has(c));
  if (acierto) {
    return { veredicto: "si", origen: nombreDePais(acierto), fuente };
  }
  return { veredicto: "no", origen: nombreDePais(codigos[0]), fuente };
}

/** Fuente 1: MusicBrainz. La más fiable cuando sabe algo. */
async function porMusicBrainz(
  artist: string,
  buscados: Set<string>,
): Promise<VeredictoOrigen> {
  const origen = await searchArtistOrigin(artist);
  if (!origen) return NO_LO_SE;

  // El país declarado manda; si falta, probamos con el área de origen y la actual.
  const code =
    origen.country ??
    codePorArea(origen.beginAreaName) ??
    codePorArea(origen.areaName);
  if (!code) {
    // Sin país reconocible: no bloqueamos (puede ser un área rara o un artista
    // que MusicBrainz tiene a medias). Guardamos el rastro para el log.
    return {
      veredicto: "desconocido",
      origen: origen.beginAreaName ?? origen.areaName ?? null,
    };
  }
  return veredictoPorCodigos([code], buscados, "musicbrainz");
}

/** Fuente 2: Wikidata. Dato estructurado, y mucho mejor repartido por el mundo. */
async function porWikidata(
  artist: string,
  buscados: Set<string>,
): Promise<VeredictoOrigen> {
  const codigos = await conTope(origenDeArtista(artist), TOPE_RESPALDO_MS);
  return veredictoPorCodigos(codigos ?? [], buscados, "wikidata");
}

/**
 * Fuente 3: la primera frase de la Wikipedia del artista.
 *
 * Es texto libre, o sea la fuente más floja de las tres, y por eso se lee con
 * una regla estricta: solo vale si la frase nombra UN país. "Una banda
 * venezolana que canta en inglés" nombra dos, y ahí preferimos callarnos antes
 * que acertar a medias.
 */
async function porWikipedia(
  artist: string,
  buscados: Set<string>,
): Promise<VeredictoOrigen> {
  const intro = await conTope(getArtistIntro(artist), TOPE_RESPALDO_MS);
  if (!intro) return NO_LO_SE;

  const frase = firstFactSentence(intro.text, 400) ?? intro.text.slice(0, 400);
  const codigos = paisesEnFrase(frase, intro.lang === "en" ? "en" : "es");
  if (codigos.length !== 1) return NO_LO_SE;
  return veredictoPorCodigos(codigos, buscados, "wikipedia");
}

/**
 * Delante de estos, un gentilicio inglés no habla del país: "Latin American",
 * "South African"... y sobre todo "African-American", que es de Estados Unidos
 * pero se colaría como cualquier otra cosa. Es la trampa clásica de leer
 * nacionalidades a base de palabras.
 */
const ANTES_QUE_NO_CUENTA = /(latin|south|central|north|pan|native)[\s-]$/;

/** Qué países nombra una frase. Vacío = no lo dice; más de uno = ambiguo. */
export function paisesEnFrase(frase: string, lang: "es" | "en"): string[] {
  const texto = normalizar(frase);
  if (!texto) return [];

  const encontrados: string[] = [];
  for (const p of PAISES) {
    // En español el gentilicio admite sufijos (venezolan → venezolano/a/os/as)
    // y la tabla ya trae el nombre del país entre sus claves. En inglés van por
    // separado, porque el nombre y el gentilicio se comportan distinto.
    const sueltos =
      lang === "es"
        ? p.claves.map((c) => `${c}${SUFIJO_GENTILICIO}`)
        : p.clavesEn.map((c) => `${c}s?`);

    // Los NOMBRES de país en inglés solo cuentan detrás de una preposición de
    // lugar ("musicians from Mali", "born in Senegal"). Sin esa condición, media
    // Wikipedia inglesa se vuelve un mapa: "Chad Smith" sería de Chad, "Jordan"
    // de Jordania y "Atlanta, Georgia" del país de Georgia. Con ella, esas tres
    // dejan de contar y "from Mali" sigue funcionando, que es lo que hace falta
    // para los artistas de países pequeños.
    const conPreposicion =
      lang === "en" ? [...(p.areas ?? []), nombreEnIngles(p.code), p.nombre] : [];

    const busquedas = [
      ...sueltos.map((re) => ({ re, preposicion: false })),
      ...conPreposicion.filter(Boolean).map((re) => ({ re, preposicion: true })),
    ];

    for (const { re: patron, preposicion } of busquedas) {
      const prefijo = preposicion ? "(?:from|in|of|based in)\\s+" : "";
      const re = new RegExp(`(?:^|\\s)${prefijo}${patron}(?=\\s|$)`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(texto)) !== null) {
        const antes = texto.slice(0, m.index + 1);
        if (lang === "en" && ANTES_QUE_NO_CUENTA.test(antes)) continue;
        if (!encontrados.includes(p.code)) encontrados.push(p.code);
        break;
      }
      if (encontrados.includes(p.code)) break;
    }
    // Con dos ya sabemos que la frase es ambigua: no hace falta seguir.
    if (encontrados.length > 1) break;
  }
  return encontrados;
}

/**
 * Las fuentes, EN ORDEN de cuánto se fían de ellas. Este array es la única
 * definición del orden: lo usan tanto la barrera (que para en la primera que
 * responde) como el diagnóstico del panel (que las prueba todas). Si algún día
 * entra una cuarta fuente, entra aquí y ya está.
 */
const FUENTES: {
  fuente: FuenteOrigen;
  pregunta: (artist: string, buscados: Set<string>) => Promise<VeredictoOrigen>;
}[] = [
  { fuente: "musicbrainz", pregunta: porMusicBrainz },
  { fuente: "wikidata", pregunta: porWikidata },
  { fuente: "wikipedia", pregunta: porWikipedia },
];

/**
 * ¿El artista es de alguno de los países pedidos? Se pregunta a MusicBrainz,
 * y si no sabe, a Wikidata y a la Wikipedia (ver la cabecera del archivo).
 *
 * Ante cualquier duda (artista no encontrado, sin dato de origen, fuentes
 * caídas) devuelve "desconocido" y quien llama deja pasar: preferimos un disco
 * de más que dejar al oyente sin disco.
 */
export async function artistaEsDeAlgunPais(
  artist: string,
  paises: PaisPedido[],
): Promise<VeredictoOrigen> {
  if (paises.length === 0) return NO_LO_SE;
  const clave = normalizar(artist);
  if (!clave) return NO_LO_SE;

  const cacheKey = `${clave}|${paises.map((p) => p.code).sort().join(",")}`;
  const enCache = cache.get(cacheKey);
  if (enCache) return enCache;

  const buscados = new Set(paises.map((p) => p.code));
  let resultado: VeredictoOrigen = NO_LO_SE;

  for (const f of FUENTES) {
    try {
      const dice = await f.pregunta(artist, buscados);
      if (dice.veredicto !== "desconocido") {
        resultado = dice;
        break;
      }
      // Guardamos el rastro aunque no sea concluyente (MusicBrainz a veces da
      // un área que no sabemos traducir a país): ayuda a leer los logs.
      if (dice.origen && !resultado.origen) resultado = dice;
    } catch (err) {
      console.warn(`[origin-guard] ${f.fuente} no pudo decirme el origen:`, err);
    }
  }

  if (resultado.veredicto !== "desconocido") {
    console.log(
      `[origin-guard] ${artist}: ${resultado.veredicto} (${resultado.origen ?? "?"}, según ${resultado.fuente})`,
    );
  }

  cache.set(cacheKey, resultado);
  return resultado;
}

export type SondaOrigen = {
  fuente: FuenteOrigen;
  ms: number;
  veredicto: VeredictoOrigen["veredicto"];
  /** Lo que resultó saber, para leerlo de un vistazo. */
  dice: string;
};

/**
 * Lo mismo, pero preguntando a TODAS las fuentes y contando qué dijo cada una.
 *
 * Existe para el panel del dueño: estas tres fuentes son APIs públicas de
 * terceros, y desde fuera no hay manera de saber si siguen contestando —
 * cuando una se cae o cambia, la barrera no se rompe (se calla, que es lo
 * correcto), así que el fallo es INVISIBLE. Con esto se ve en una pulsación,
 * sin terminal y sin logs de Vercel. No gasta ni un céntimo de IA.
 */
export async function diagnosticoDeOrigen(
  artist: string,
  paises: PaisPedido[],
): Promise<{ sondas: SondaOrigen[]; veredicto: VeredictoOrigen }> {
  const buscados = new Set(paises.map((p) => p.code));
  const sondas: SondaOrigen[] = [];
  let veredicto: VeredictoOrigen = NO_LO_SE;

  for (const f of FUENTES) {
    const t0 = Date.now();
    let dice: VeredictoOrigen = NO_LO_SE;
    let nota: string;
    try {
      dice = await f.pregunta(artist, buscados);
      nota =
        dice.veredicto === "si"
          ? `sí, es de ${dice.origen}`
          : dice.veredicto === "no"
            ? `no: es de ${dice.origen}`
            : dice.origen
              ? `no sabe (solo tiene "${dice.origen}")`
              : "no sabe nada de este artista";
    } catch (err) {
      nota = `falló: ${(err as Error).message}`;
    }
    sondas.push({
      fuente: f.fuente,
      ms: Date.now() - t0,
      veredicto: dice.veredicto,
      dice: nota,
    });
    if (veredicto.veredicto === "desconocido" && dice.veredicto !== "desconocido") {
      veredicto = dice;
    }
  }

  return { sondas, veredicto };
}

/** Texto para el prompt: "artistas de Venezuela" / "de Argentina o Uruguay". */
export function nombresDePaises(paises: PaisPedido[]): string {
  const nombres = paises.map((p) => p.nombre);
  if (nombres.length <= 1) return nombres[0] ?? "";
  return `${nombres.slice(0, -1).join(", ")} o ${nombres[nombres.length - 1]}`;
}
