// Fase 11 — EL ATLAS: "Conociendo a…", la música como manera de conocer un país.
//
// La idea del dueño: elegir un país y que la IA te cuente qué se sabe de él a
// través de cinco discos. Es el tercer eje de Musicart, y por eso tiene sitio
// propio: los Caminos entran por un GÉNERO, el Salón entra por el PRESTIGIO y
// esto entra por un LUGAR.
//
// Tres decisiones que lo sostienen (están razonadas en el ROADMAP):
//
// 1. El motor NO es filtrar el canon por país. El índice del Salón sale de
//    Wikidata por número de artículos de Wikipedia, y eso escora brutalmente al
//    mundo anglosajón: Venezuela daría dos discos y Estados Unidos quinientos.
//    Aquí PROPONE el curador —que sí conoce lo de fuera del canon— y después se
//    comprueba con datos duros.
// 2. Y se comprueba en serio: cada artista pasa por la barrera de origen de la
//    7.11 (MusicBrainz → Wikidata → Wikipedia). Si consta que no es de ese
//    país, el disco NO entra en el retrato. Es la diferencia entre un atlas y
//    una lista de discos con una bandera encima. Lo que no se pudo confirmar
//    entra, pero DICIÉNDOLO — la app no finge saber.
// 3. El retrato de un país es igual para todos, así que se cachea GLOBAL (una
//    fila por país). El segundo que entra a Malí lo ve al instante y gratis.
//    Esto es lo contrario que los Caminos, que son de cada oyente.

import { prisma } from "./db";
import { llmGeneration, extractJson, hayClaveIA } from "./dossier/llm";
import { runDossierPipeline } from "./dossier/pipeline";
import { hayPresupuestoHoy, registrarGeneracion } from "./budget";
import { todayKey } from "./daily";
import { parseJson } from "./types";
import { paisPorCodigo, type Pais } from "./paises";
import { artistaEsDeAlgunPais } from "./origin-guard";
import {
  DISCOS_POR_RETRATO,
  ETIQUETA_PAPEL,
  MINIMO_PARA_RETRATO,
  PAPELES,
  SENTIDO_PAPEL,
  papelValido,
  type DiscoDelRetrato,
  type Papel,
  type Retrato,
} from "./atlas-tipos";

export * from "./atlas-tipos";

// Proponer cinco discos con su porqué es una generación larga en runtime. Los
// números salen de la lección de la 8.7: con 30 s y 1.400 tokens la respuesta
// llegaba cortada y el JSON no parseaba.
const LLM_TIMEOUT_MS = 75_000;
const MAX_TOKENS_RETRATO = 2200;
const INTENTOS = 2;

/** Un retrato vacío se puede reintentar, pero no en cada visita. */
const REINTENTO_TRAS_MS = 24 * 60 * 60 * 1000;

// ─── Lectura ─────────────────────────────────────────────────────────────────

function aRetrato(fila: {
  code: string;
  titulo: string;
  intro: string | null;
  discosJson: string;
  status: string;
  nota: string | null;
  updatedAt: Date;
}, pais: Pais | null): Retrato {
  const discos = parseJson<DiscoDelRetrato[]>(fila.discosJson, []).map((d, i) => ({
    ...d,
    orden: typeof d.orden === "number" ? d.orden : i + 1,
    albumId: d.albumId ?? null,
    origen: d.origen === "si" ? ("si" as const) : ("desconocido" as const),
  }));
  return {
    code: fila.code,
    pais: pais?.nombre ?? fila.code,
    titulo: fila.titulo,
    intro: fila.intro,
    discos,
    status: fila.status === "vacio" ? "vacio" : "listo",
    nota: fila.nota,
    actualizado: fila.updatedAt,
  };
}

/** El retrato que ya está guardado, si lo hay. Barato: una fila por código. */
export async function getRetrato(code: string): Promise<Retrato | null> {
  const pais = paisPorCodigo(code);
  if (!pais) return null;
  const fila = await prisma.retratoPais.findUnique({ where: { code: pais.code } });
  return fila ? aRetrato(fila, pais) : null;
}

/** Qué países tienen ya su retrato hecho (para marcarlos en el índice). */
export async function codigosConRetrato(): Promise<Set<string>> {
  try {
    const filas = await prisma.retratoPais.findMany({
      where: { status: "listo" },
      select: { code: true },
    });
    return new Set(filas.map((f) => f.code));
  } catch {
    // El índice del Atlas se enseña igual sin esta marca: es un adorno útil,
    // no la sección.
    return new Set();
  }
}

/** ¿Toca volver a intentarlo? Un "no pude" no se reintenta en cada visita. */
function sePuedeReintentar(retrato: Retrato): boolean {
  if (retrato.status === "listo") return false;
  return Date.now() - retrato.actualizado.getTime() > REINTENTO_TRAS_MS;
}

// ─── Fabricación del retrato ─────────────────────────────────────────────────

type PropuestaDisco = {
  papel: Papel;
  title: string;
  artist: string;
  year: number | null;
  porque: string;
};

const REGLAS_DISCO = `- Debe ser un disco REAL y bien documentado (que exista en MusicBrainz/Wikipedia), con título y artista EXACTOS. Nada inventado.
- Debe ser un ÁLBUM DE ESTUDIO ORIGINAL. PROHIBIDO: sencillos, EPs, discos en vivo y sobre todo RECOPILATORIOS / grandes éxitos / antologías ("Lo Esencial", "Greatest Hits", "The Best of", "Anthology"…). Se encuentran fatal en streaming.
- El artista tiene que ser DE ESE PAÍS. No vale un extranjero que grabó allí ni un disco "inspirado en" el país: lo comprobamos después con datos duros y lo tiramos.`;

async function proponerRetrato(
  pais: Pais,
  evitar: string[] = [],
): Promise<{ titulo: string; intro: string; discos: PropuestaDisco[] } | null> {
  const papeles = PAPELES.map(
    (p) => `   - ${p} (${ETIQUETA_PAPEL[p]}): ${SENTIDO_PAPEL[p]}`,
  ).join("\n");

  const evitarTexto =
    evitar.length > 0
      ? `\nNO propongas estos artistas (ya los descarté porque no consta que sean de ${pais.nombre}):\n${evitar.map((a) => `- ${a}`).join("\n")}\n`
      : "";

  const system = `Eres el curador musical de Musicart. Eres cercano y melómano, hablas en español y de "tú".
Tu trabajo: EL RETRATO MUSICAL DE UN PAÍS. Alguien que no conoce ${pais.nombre} va a conocerlo a través de cinco discos.

LA IDEA: no es "los cinco mejores discos del país" ni un ranking. Es lo que un país cuenta de sí mismo cuando suena. Alguien tiene que terminar sabiendo algo del país que antes no sabía — de su historia, de sus mezclas, de sus heridas y de lo que le está pasando ahora.

Reglas estrictas:
1. Responde SOLO un objeto JSON, sin texto extra:
{"titulo": "...", "intro": "...", "discos": [{"papel": "raiz", "title": "...", "artist": "...", "year": 1975, "porque": "..."}, …]}
2. EXACTAMENTE ${DISCOS_POR_RETRATO} discos, con "papel" en este orden: ${PAPELES.map((p) => `"${p}"`).join(", ")}.
${papeles}
3. Sobre cada disco:
${REGLAS_DISCO}
4. CINCO ARTISTAS DISTINTOS.
5. "porque" (1-2 frases): qué cuenta ESE disco sobre el país. No describas el sonido y ya: di qué se entiende del país al escucharlo. Esta frase es el producto.
6. "intro" (2-3 frases): qué vas a conocer de ${pais.nombre} escuchando estos cinco. Concreto, sin turismo ni tópicos ("tierra de ritmos alegres" no dice nada).
7. "titulo": corto, con alma, y con el país dentro ("Conociendo a ${pais.nombre}" vale, pero puedes hacerlo mejor).
8. NADA DE EXOTISMO. Un país no es una postal ni un souvenir. Habla de su música como hablarías de la de tu casa: con detalle y sin condescendencia.
9. Escribe en español. No inventes datos del disco (los hechos verificados los pone después nuestro pipeline): tú aquí eliges y explicas por qué.`;

  const user = `PAÍS: ${pais.nombre}
${evitarTexto}
Arma el retrato. Responde el JSON ahora.`;

  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      const raw = await llmGeneration({
        system,
        user:
          intento === 1
            ? user
            : `${user}\n\nIMPORTANTE: la respuesta anterior no llegó completa. Sé más breve en los "porque" (una frase) y asegúrate de CERRAR el JSON.`,
        temperature: intento === 1 ? 0.7 : 0.5,
        maxTokens: MAX_TOKENS_RETRATO,
        timeoutMs: LLM_TIMEOUT_MS,
      });

      const parsed = extractJson<{
        titulo?: string;
        intro?: string;
        discos?: Array<{
          papel?: string;
          title?: string;
          artist?: string;
          year?: number;
          porque?: string;
        }>;
      }>(raw);

      const discos: PropuestaDisco[] = (parsed?.discos ?? [])
        .filter((d) => d?.title?.trim() && d?.artist?.trim() && papelValido(d.papel))
        .map((d) => ({
          papel: d.papel as Papel,
          title: String(d.title).trim(),
          artist: String(d.artist).trim(),
          year: typeof d.year === "number" && d.year > 1900 ? d.year : null,
          porque: String(d.porque ?? "").trim(),
        }));

      if (discos.length >= MINIMO_PARA_RETRATO) {
        return {
          titulo: parsed?.titulo?.trim() || `Conociendo a ${pais.nombre}`,
          intro: parsed?.intro?.trim() ?? "",
          discos,
        };
      }
    } catch (err) {
      console.warn(`[atlas] la propuesta de ${pais.nombre} falló:`, err);
    }
  }
  return null;
}

/**
 * La barrera de origen sobre cada disco propuesto (7.11).
 *
 * Aquí está la diferencia entre un atlas y una lista con bandera: si consta que
 * el artista NO es de ese país, fuera. Lo que no se pudo confirmar se queda,
 * pero marcado, y el oyente lo ve.
 */
async function verificarOrigenes(
  pais: Pais,
  discos: PropuestaDisco[],
): Promise<{ aceptados: DiscoDelRetrato[]; rechazados: string[] }> {
  const pedido = [{ code: pais.code, nombre: pais.nombre }];

  const veredictos = await Promise.all(
    discos.map(async (d) => {
      try {
        return await artistaEsDeAlgunPais(d.artist, pedido);
      } catch {
        return { veredicto: "desconocido" as const, origen: null };
      }
    }),
  );

  const aceptados: DiscoDelRetrato[] = [];
  const rechazados: string[] = [];

  discos.forEach((d, i) => {
    const v = veredictos[i];
    if (v.veredicto === "no") {
      console.warn(
        `[atlas] ${d.artist} fuera del retrato de ${pais.nombre}: es de ${v.origen}.`,
      );
      rechazados.push(d.artist);
      return;
    }
    aceptados.push({
      orden: aceptados.length + 1,
      papel: d.papel,
      title: d.title,
      artist: d.artist,
      year: d.year,
      porque: d.porque,
      albumId: null,
      origen: v.veredicto === "si" ? "si" : "desconocido",
      fuente: v.fuente,
    });
  });

  return { aceptados, rechazados };
}

async function guardarRetrato(
  pais: Pais,
  datos: {
    titulo: string;
    intro: string | null;
    discos: DiscoDelRetrato[];
    status: "listo" | "vacio";
    nota: string | null;
  },
): Promise<Retrato> {
  const fila = await prisma.retratoPais.upsert({
    where: { code: pais.code },
    create: {
      code: pais.code,
      titulo: datos.titulo,
      intro: datos.intro,
      discosJson: JSON.stringify(datos.discos),
      status: datos.status,
      nota: datos.nota,
    },
    update: {
      titulo: datos.titulo,
      intro: datos.intro,
      discosJson: JSON.stringify(datos.discos),
      status: datos.status,
      nota: datos.nota,
    },
  });
  return aRetrato(fila, pais);
}

/**
 * El retrato de un país: el guardado si existe, o uno nuevo.
 *
 * Nunca lanza y nunca devuelve una promesa a medias: si algo falla, guarda un
 * retrato "vacío" con la razón EN CRISTIANO y escrita por el código (nunca por
 * un LLM, que suele ser justo lo que está caído). Es la misma regla que la
 * `CausaFallback` del disco del día: la app no se cae, pero tampoco miente.
 */
export async function retratoDePais(
  code: string,
  opciones: { rehacer?: boolean } = {},
): Promise<Retrato | null> {
  const pais = paisPorCodigo(code);
  if (!pais) return null;

  const guardado = await getRetrato(pais.code);
  if (guardado && !opciones.rehacer) {
    if (guardado.status === "listo" || !sePuedeReintentar(guardado)) return guardado;
  }

  if (!hayClaveIA()) {
    return guardarRetrato(pais, {
      titulo: `Conociendo a ${pais.nombre}`,
      intro: null,
      discos: [],
      status: "vacio",
      nota: "Ahora mismo no puedo escribir retratos nuevos. Vuelve en un rato.",
    });
  }

  const propuesta = await proponerRetrato(pais);
  if (!propuesta) {
    return guardarRetrato(pais, {
      titulo: `Conociendo a ${pais.nombre}`,
      intro: null,
      discos: [],
      status: "vacio",
      nota: `No conseguí armar el retrato de ${pais.nombre} esta vez. Puedes volver a intentarlo mañana.`,
    });
  }

  const primera = await verificarOrigenes(pais, propuesta.discos);
  let aceptados = primera.aceptados;
  const rechazados = primera.rechazados;

  // Si la barrera se llevó por delante a varios, se pide UNA tanda más sin esos
  // artistas. Rellenar un retrato a medias con lo primero que salga sería
  // justo lo que esta sección no puede hacer.
  if (aceptados.length < MINIMO_PARA_RETRATO && rechazados.length > 0) {
    const segunda = await proponerRetrato(pais, rechazados);
    if (segunda) {
      const otra = await verificarOrigenes(pais, segunda.discos);
      if (otra.aceptados.length > aceptados.length) {
        aceptados = otra.aceptados;
        propuesta.titulo = segunda.titulo || propuesta.titulo;
        propuesta.intro = segunda.intro || propuesta.intro;
      }
    }
  }

  if (aceptados.length < MINIMO_PARA_RETRATO) {
    return guardarRetrato(pais, {
      titulo: `Conociendo a ${pais.nombre}`,
      intro: null,
      discos: [],
      status: "vacio",
      nota:
        `De ${pais.nombre} no consigo reunir cinco discos que pueda verificar. ` +
        `Prefiero decírtelo a llenarte esto de discos que no sé si son de ahí.`,
    });
  }

  return guardarRetrato(pais, {
    titulo: propuesta.titulo,
    intro: propuesta.intro || null,
    discos: aceptados,
    status: "listo",
    nota: null,
  });
}

// ─── Abrir un disco del retrato ──────────────────────────────────────────────

export type AbrirDiscoResult =
  | { ok: true; albumId: string }
  | { ok: false; reason: "no-encontrado" | "presupuesto" | "no-verificado" | "error" };

/**
 * Fabrica el dossier de un disco del retrato (o devuelve el que ya existe).
 *
 * Igual que un paso de un Camino o un disco del Salón: perezoso y con el tope
 * de gasto del día por delante, en su parte "extra" — curiosear el Atlas no
 * puede dejar al disco del día sin cupo.
 */
export async function abrirDiscoDelAtlas(
  code: string,
  orden: number,
): Promise<AbrirDiscoResult> {
  try {
    const retrato = await getRetrato(code);
    if (!retrato) return { ok: false, reason: "no-encontrado" };

    const disco = retrato.discos.find((d) => d.orden === orden);
    if (!disco) return { ok: false, reason: "no-encontrado" };
    if (disco.albumId) return { ok: true, albumId: disco.albumId };

    const date = todayKey(null);
    if (!(await hayPresupuestoHoy(date, "extra"))) {
      return { ok: false, reason: "presupuesto" };
    }

    const result = await runDossierPipeline(disco.title, disco.artist, {
      publish: true,
    });
    if (!result.reused) await registrarGeneracion(date);

    if (result.status !== "published") {
      console.warn(
        `[atlas] "${disco.title}" de ${disco.artist} no pasó verificación (quedó en borrador).`,
      );
      return { ok: false, reason: "no-verificado" };
    }

    const discos = retrato.discos.map((d) =>
      d.orden === orden ? { ...d, albumId: result.albumId } : d,
    );
    await prisma.retratoPais.update({
      where: { code: retrato.code },
      data: { discosJson: JSON.stringify(discos) },
    });

    return { ok: true, albumId: result.albumId };
  } catch (err) {
    console.error("[atlas] no se pudo abrir el disco:", err);
    return { ok: false, reason: "error" };
  }
}
