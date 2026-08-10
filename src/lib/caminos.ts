// Fase 8 — Caminos: "¿por dónde entro a este género?".
//
// La idea del dueño: a alguien que nunca ha leído no le das el Quijote de
// entrada, le das un Harry Potter. Pero el camino NO esconde el Quijote — te
// lleva hasta él y te lo dice desde el primer paso. Cinco discos en orden, donde
// cada uno te deja el oído listo para el siguiente.
//
// Vive aparte del disco del día: aquí no se toca nada del ritual (`recommend.ts`
// no se entera de que esto existe). El camino entero se propone con UNA llamada
// al LLM (barata); el dossier de cada disco se fabrica el día que el oyente llega
// a él, reutilizando el pipeline anti-alucinación. Los canónicos que ya estén en
// catálogo vuelven como `reused` y no cuestan nada.

import { prisma } from "./db";
import { llmGeneration, extractJson, hayClaveIA } from "./dossier/llm";
import { runDossierPipeline } from "./dossier/pipeline";
import { hayPresupuestoHoy, registrarGeneracion } from "./budget";
import { todayKey } from "./daily";
import { parseJson } from "./types";
import { perfilATexto, diarioATexto } from "./recommend";
import { curatorVoz } from "./curators";
import type { ListenerIdentity } from "./identity";
import type { Camino, Prisma } from "@prisma/client";
import {
  PASOS_POR_CAMINO,
  papelValido,
  pasoAbierto,
  pasoActual,
  type CaminoStep,
  type Papel,
} from "./caminos-pasos";

// Tipos y helpers puros viven en `caminos-pasos.ts` (los usa también la UI de
// cliente, que no puede importar este módulo sin arrastrar el pipeline).
export * from "./caminos-pasos";

// Proponer 5 discos CON su puente es la generación más larga que hacemos en
// runtime: son ~1.500 tokens de español. Con 30 s no le daba el tiempo a un
// modelo premium y el camino moría en "no pude trazar este camino" — por eso
// ahora espera lo que de verdad tarda (la route aguanta 120 s) y reintenta.
const LLM_TIMEOUT_MS = 75_000;
const MAX_TOKENS_CAMINO = 2200; // con 1400 la respuesta se cortaba y el JSON no parseaba
const INTENTOS = 2;

export type CaminoConPasos = {
  id: string;
  tema: string;
  titulo: string;
  intro: string | null;
  status: string;
  pasos: CaminoStep[];
  createdAt: Date;
};

// ─── Lectura ─────────────────────────────────────────────────────────────────

function caminoWhere(identity: ListenerIdentity): Prisma.CaminoWhereInput | null {
  if (identity.userId) {
    return {
      OR: [
        { userId: identity.userId },
        ...(identity.deviceId ? [{ deviceId: identity.deviceId }] : []),
      ],
    };
  }
  if (identity.deviceId) return { deviceId: identity.deviceId };
  return null;
}

export function pasosDe(camino: Pick<Camino, "stepsJson">): CaminoStep[] {
  return parseJson<CaminoStep[]>(camino.stepsJson, []).map((p, i) => ({
    ...p,
    orden: typeof p.orden === "number" ? p.orden : i + 1,
    albumId: p.albumId ?? null,
    escuchadoAt: p.escuchadoAt ?? null,
  }));
}

function aCaminoConPasos(c: Camino): CaminoConPasos {
  return {
    id: c.id,
    tema: c.tema,
    titulo: c.titulo,
    intro: c.intro,
    status: c.status,
    pasos: pasosDe(c),
    createdAt: c.createdAt,
  };
}

export async function listarCaminos(
  identity: ListenerIdentity,
): Promise<CaminoConPasos[]> {
  const where = caminoWhere(identity);
  if (!where) return [];
  const filas = await prisma.camino.findMany({
    where,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 20,
  });
  return filas.map(aCaminoConPasos);
}

export async function getCamino(
  id: string,
  identity: ListenerIdentity,
): Promise<CaminoConPasos | null> {
  const where = caminoWhere(identity);
  if (!where) return null;
  const camino = await prisma.camino.findFirst({ where: { AND: [{ id }, where] } });
  return camino ? aCaminoConPasos(camino) : null;
}

/** Resumen para la tira de la home. Barato: una fila, sin joins. */
export async function getCaminoEnCurso(
  identity: ListenerIdentity,
): Promise<{ id: string; titulo: string; paso: number; total: number } | null> {
  try {
    const where = caminoWhere(identity);
    if (!where) return null;
    const camino = await prisma.camino.findFirst({
      where: { AND: [{ status: "activo" }, where] },
      orderBy: { updatedAt: "desc" },
    });
    if (!camino) return null;
    const pasos = pasosDe(camino);
    if (pasos.length === 0) return null;
    return {
      id: camino.id,
      titulo: camino.titulo,
      paso: pasoActual(pasos),
      total: pasos.length,
    };
  } catch (err) {
    // La home nunca se rompe por la tira del camino: se omite y ya.
    console.error("[caminos] no se pudo leer el camino en curso:", err);
    return null;
  }
}

// ─── Proponer el camino (una sola llamada al LLM) ────────────────────────────

type PropuestaCamino = {
  titulo: string;
  intro: string;
  pasos: CaminoStep[];
};

const REGLAS_DISCO = `- Debe ser un disco REAL y bien documentado (que exista en MusicBrainz/Wikipedia), con título y artista EXACTOS. Nada inventado.
- Debe ser un ÁLBUM DE ESTUDIO ORIGINAL Y CANÓNICO. PROHIBIDO: sencillos, EPs, discos en vivo y sobre todo RECOPILATORIOS / grandes éxitos / antologías ("Lo Esencial", "Greatest Hits", "The Best of", "Anthology", "MTV Unplugged"…). Se encuentran fatal en streaming. Si piensas en una recopilación, elige el álbum de estudio donde están esas canciones.`;

/**
 * Pide al LLM el camino entero de una vez: 5 discos en orden pedagógico, cada
 * uno con su papel y su puente. Una sola llamada, así que crear un camino es
 * barato — lo caro (fabricar dossiers) se hace paso a paso y solo si el oyente
 * avanza de verdad.
 */
export async function proponerCamino(input: {
  tema: string;
  perfilTexto: string;
  diarioTexto: string;
  voz?: string;
  /** Discos que ya conoce: no se los pongamos como "descubrimiento". */
  yaConoce?: string[];
  /** Papeles que hay que respetar (para reemplazar un paso suelto se pasa uno). */
  soloPaso?: { orden: number; papel: Papel; evitar: string[]; contexto: string };
}): Promise<PropuestaCamino> {
  const vozCurador = input.voz?.trim()
    ? `${input.voz.trim()} Hablas en español y de "tú".`
    : `Eres cercano y melómano, hablas en español y de "tú".`;

  const yaConoceTexto =
    input.yaConoce && input.yaConoce.length > 0
      ? `\nDISCOS QUE YA CONOCE (no se los propongas como descubrimiento; si uno es IMPRESCINDIBLE para entender el camino, puedes usarlo, pero dilo en su "puente"):\n${input.yaConoce.map((t) => `- ${t}`).join("\n")}\n`
      : "";

  const system = `Eres el curador musical de Musicart. ${vozCurador}
Tu trabajo: armar UN CAMINO DE ENTRADA para alguien que quiere meterse en algo que todavía no conoce.

LA IDEA (métetela en la cabeza): a alguien que nunca ha leído no le recomiendas el Quijote de entrada, le recomiendas un Harry Potter. Pero NO escondes el Quijote: lo pones al final del camino y le dices desde el principio que va a llegar ahí. Ordenar mal es condenar a alguien a odiar un género que habría amado.

Reglas estrictas:
1. Responde SOLO un objeto JSON, sin texto extra:
{"titulo": "...", "intro": "...", "pasos": [{"orden": 1, "title": "...", "artist": "...", "year": 1970, "papel": "puerta", "puente": "..."}, …]}
2. ${
    input.soloPaso
      ? `Esta vez NO armas un camino entero: te pido UN SOLO paso de reemplazo, el que se te indica abajo, respetando su papel. Devuelve "pasos" con ese único objeto.`
      : `EXACTAMENTE ${PASOS_POR_CAMINO} pasos, con "papel" en este orden: "puerta", "gancho", "canon", "desvio", "cima".`
  }
   Qué significa cada papel:
   - puerta: por donde se entra. Accesible, melódico, engancha sin pedir nada. NO el más importante — el más hospitalario.
   - gancho: ya dentro del género, el que le hace querer más.
   - canon: el que hay que pasar sí o sí para entender de qué va esto.
   - desvio: una puerta lateral que enseña que el género no es una sola cosa (otro país, otra época, otra rama).
   - cima: el exigente, el "Quijote". Llega aquí con oído entrenado y lo disfruta en vez de sufrirlo.
3. Sobre cada disco:
${REGLAS_DISCO}
4. CINCO ARTISTAS DISTINTOS. Un camino con dos discos del mismo grupo enseña un grupo, no un género.
5. EL ORDEN ES EL PRODUCTO. "puente" (1-2 frases) explica por qué ese disco va JUSTO AHÍ y, sobre todo, QUÉ LE DEJA EL PASO ANTERIOR para disfrutar este ("después de X ya distingues el doble bombo, así que ahora…"). Del paso 2 en adelante, el puente DEBE referirse a lo que ganó en el anterior. Sin esto, esto es una playlist cualquiera y no sirve.
6. "intro" (2-3 frases): la promesa del camino. OBLIGATORIO nombrar el disco de la CIMA y decirle que va a llegar ahí. Nada de misterio: saber a dónde va es lo que quita la condescendencia.
7. "titulo": corto y con alma ("El camino al heavy metal"). Sin comillas dentro.
8. NADA DE CONDESCENDENCIA. No es un tonto ni un niño: es alguien con buen gusto que todavía no tiene el mapa de ESTE territorio. Habla de discos, no de "niveles".
9. EL PUNTO DE ENTRADA DEPENDE DE ÉL. Mira su perfil: quien ya escucha rock duro entra al metal por una puerta distinta que quien solo escucha pop. Usa lo que ya ama como rampa y dilo en los puentes cuando venga a cuento — pero sin forzarlo ni inventarle nada que no esté abajo.
10. Escribe en español, cálido y concreto. Nada de inventar datos del disco: los hechos verificados los pone después nuestro pipeline; tú aquí solo eliges y explicas el orden.`;

  const user = input.soloPaso
    ? `PERFIL DEL OYENTE:
${input.perfilTexto}

CAMINO EN CURSO («${input.tema}»), estos son sus pasos:
${input.soloPaso.contexto}

REEMPLAZA SOLO EL PASO ${input.soloPaso.orden} (papel "${input.soloPaso.papel}").
NO propongas ninguno de estos (ya están en el camino o los descartó):
${input.soloPaso.evitar.map((t) => `- ${t}`).join("\n")}

Responde el MISMO JSON de siempre pero con "pasos" conteniendo UN SOLO paso: el reemplazo, con "orden": ${input.soloPaso.orden} y "papel": "${input.soloPaso.papel}". "titulo" e "intro" pueden ir vacíos.`
    : `LO QUE QUIERE DESCUBRIR: «${input.tema}»

PERFIL DEL OYENTE:
${input.perfilTexto}

SU DIARIO (lo que ha reseñado, de lo más nuevo a lo más viejo):
${input.diarioTexto}
${yaConoceTexto}
Arma el camino. Responde el JSON ahora.`;

  // Un camino incompleto no es un camino: si la respuesta viene cortada o el
  // modelo se cae, se reintenta entero en vez de servir cuatro pasos sin cima.
  // Es UNA llamada barata; gastar dos de vez en cuando sale mejor que un error.
  let ultimoError: unknown = null;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      const raw = await llmGeneration({
        system,
        user:
          intento === 1
            ? user
            : `${user}\n\nIMPORTANTE: la respuesta anterior no llegó completa. Sé más breve en los "puente" (una frase cada uno) y asegúrate de CERRAR el JSON.`,
        temperature: intento === 1 ? 0.7 : 0.5,
        maxTokens: MAX_TOKENS_CAMINO,
        timeoutMs: LLM_TIMEOUT_MS,
      });

      const parsed = extractJson<{
        titulo?: string;
        intro?: string;
        pasos?: Array<{
          orden?: number;
          title?: string;
          artist?: string;
          year?: number;
          papel?: string;
          puente?: string;
        }>;
      }>(raw);

      const crudos = Array.isArray(parsed.pasos) ? parsed.pasos : [];
      const pasos: CaminoStep[] = [];
      for (const p of crudos) {
        if (!p.title?.trim() || !p.artist?.trim()) continue;
        const orden = pasos.length + 1;
        pasos.push({
          orden,
          title: p.title.trim(),
          artist: p.artist.trim(),
          year: typeof p.year === "number" ? p.year : null,
          papel: papelValido(p.papel, orden),
          puente: (p.puente ?? "").trim().slice(0, 600),
          albumId: null,
          escuchadoAt: null,
        });
      }

      // Un camino entero son 5 pasos; un reemplazo suelto, uno. Menos que eso
      // es una respuesta a medias, y se reintenta.
      const esperados = input.soloPaso ? 1 : PASOS_POR_CAMINO;
      if (pasos.length < esperados) {
        throw new Error(
          `Propuesta incompleta (${pasos.length} de ${esperados} pasos): ${raw.slice(0, 200)}`,
        );
      }

      return {
        titulo: (parsed.titulo ?? "").trim().slice(0, 120) || `Camino: ${input.tema}`,
        intro: (parsed.intro ?? "").trim().slice(0, 800),
        pasos,
      };
    } catch (err) {
      ultimoError = err;
      console.error(`[caminos] intento ${intento} de ${INTENTOS} falló:`, err);
    }
  }

  throw ultimoError instanceof Error
    ? ultimoError
    : new Error(String(ultimoError));
}

// ─── Crear ───────────────────────────────────────────────────────────────────

export type CrearCaminoResult =
  | { ok: true; caminoId: string }
  | {
      ok: false;
      reason: "sin-identidad" | "sin-ia" | "sin-tema" | "tiempo" | "ia" | "error";
      /** El error de verdad, para el curador. Al oyente no se le enseña. */
      detalle?: string;
    };

/**
 * Traduce el fallo a algo que el oyente pueda entender y accionar. "Tardó
 * demasiado" y "la IA está caída" piden cosas distintas: volver a darle ahora o
 * volver más tarde.
 */
function razonDelFallo(err: unknown): "tiempo" | "ia" | "error" {
  const e = err as { name?: string; message?: string };
  const msg = e?.message ?? "";
  if (e?.name === "TimeoutError" || e?.name === "AbortError" || /timeout|aborted|timed out/i.test(msg)) {
    return "tiempo";
  }
  if (/^(OpenAI|Anthropic) \d+/.test(msg) || /clave de IA|API_KEY/i.test(msg)) {
    return "ia";
  }
  return "error";
}

export async function crearCamino(
  identity: ListenerIdentity,
  tema: string,
): Promise<CrearCaminoResult> {
  const limpio = tema.trim().slice(0, 200);
  if (!limpio) return { ok: false, reason: "sin-tema" };
  if (!identity.deviceId && !identity.userId) {
    return { ok: false, reason: "sin-identidad" };
  }
  // Un camino sin IA no existe: no inventamos una lista de relleno. Mejor
  // decirlo claro que servir algo que no es un camino.
  if (!hayClaveIA()) return { ok: false, reason: "sin-ia" };

  try {
    const [profile, reviews] = await Promise.all([
      prisma.profile.findFirst({
        where: identity.userId
          ? { OR: [{ userId: identity.userId }, { deviceId: identity.deviceId }] }
          : { deviceId: identity.deviceId },
      }),
      prisma.review.findMany({
        where: identity.userId
          ? { OR: [{ userId: identity.userId }, { deviceId: identity.deviceId }] }
          : { deviceId: identity.deviceId },
        include: { album: { include: { artist: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    const parsedProfile = profile
      ? parseJson<Record<string, unknown>>(profile.answersJson, {})
      : null;

    const propuesta = await proponerCamino({
      tema: limpio,
      perfilTexto: perfilATexto(parsedProfile),
      diarioTexto: diarioATexto(reviews),
      voz: curatorVoz(
        typeof parsedProfile?.curator === "string" ? parsedProfile.curator : undefined,
      ),
      yaConoce: reviews.map((r) => `"${r.album.title}" de ${r.album.artist.name}`),
    });

    const camino = await prisma.camino.create({
      data: {
        deviceId: identity.deviceId,
        userId: identity.userId,
        tema: limpio,
        titulo: propuesta.titulo,
        intro: propuesta.intro || null,
        stepsJson: JSON.stringify(propuesta.pasos),
      },
    });

    return { ok: true, caminoId: camino.id };
  } catch (err) {
    console.error("[caminos] no se pudo armar el camino:", err);
    return {
      ok: false,
      reason: razonDelFallo(err),
      detalle: (err as Error)?.message?.slice(0, 300),
    };
  }
}

// ─── Avanzar ─────────────────────────────────────────────────────────────────

async function guardarPasos(id: string, pasos: CaminoStep[], status?: string) {
  await prisma.camino.update({
    where: { id },
    data: { stepsJson: JSON.stringify(pasos), ...(status ? { status } : {}) },
  });
}

export type AbrirPasoResult =
  | { ok: true; albumId: string }
  | {
      ok: false;
      reason: "no-encontrado" | "bloqueado" | "presupuesto" | "no-verificado" | "error";
    };

/**
 * Fabrica el dossier del paso (o reutiliza el del catálogo) y lo deja listo para
 * leer. Tarda 1-3 min cuando el disco es nuevo, por eso lo llama una route con
 * `maxDuration` alto y no una server action.
 */
export async function abrirPaso(
  caminoId: string,
  orden: number,
  identity: ListenerIdentity,
): Promise<AbrirPasoResult> {
  try {
    const camino = await getCamino(caminoId, identity);
    if (!camino) return { ok: false, reason: "no-encontrado" };

    const indice = camino.pasos.findIndex((p) => p.orden === orden);
    if (indice === -1) return { ok: false, reason: "no-encontrado" };
    const paso = camino.pasos[indice];

    // Ya fabricado: gratis y al instante.
    if (paso.albumId) return { ok: true, albumId: paso.albumId };
    // El orden es el producto: no se salta.
    if (!pasoAbierto(camino.pasos, indice)) return { ok: false, reason: "bloqueado" };

    // El tope de gasto global manda también aquí (un camino no puede vaciar el
    // presupuesto del día). Reutilizar catálogo no consume, pero eso no lo
    // sabemos hasta correr el pipeline, así que comprobamos antes.
    const date = todayKey(null);
    if (!(await hayPresupuestoHoy(date))) {
      return { ok: false, reason: "presupuesto" };
    }

    const result = await runDossierPipeline(paso.title, paso.artist, {
      publish: true,
    });
    if (!result.reused) await registrarGeneracion(date);

    // Un dossier en borrador da 404 al oyente: no lo enlazamos. El paso se puede
    // reemplazar por otro disco del mismo papel (`reemplazarPaso`).
    if (result.status !== "published") {
      console.warn(
        `[caminos] "${paso.title}" de ${paso.artist} no pasó verificación (quedó en borrador).`,
      );
      return { ok: false, reason: "no-verificado" };
    }

    const pasos = camino.pasos.map((p) =>
      p.orden === orden ? { ...p, albumId: result.albumId } : p,
    );
    await guardarPasos(caminoId, pasos);
    return { ok: true, albumId: result.albumId };
  } catch (err) {
    console.error("[caminos] no se pudo abrir el paso:", err);
    return { ok: false, reason: "error" };
  }
}

/** "Ya lo escuché": abre el siguiente paso. Si era el último, cierra el camino. */
export async function marcarEscuchado(
  caminoId: string,
  orden: number,
  identity: ListenerIdentity,
): Promise<boolean> {
  const camino = await getCamino(caminoId, identity);
  if (!camino) return false;
  if (!camino.pasos.some((p) => p.orden === orden)) return false;

  const pasos = camino.pasos.map((p) =>
    p.orden === orden && !p.escuchadoAt
      ? { ...p, escuchadoAt: new Date().toISOString() }
      : p,
  );
  const completo = pasos.every((p) => p.escuchadoAt);
  await guardarPasos(caminoId, pasos, completo ? "completado" : "activo");
  return true;
}

/**
 * Cambia un paso por otro disco del mismo papel. Dos usos, uno de cada lado:
 * el oyente que ya conoce ese disco ("no me lo descubras, dame otro") y el disco
 * que no pasó la verificación, que si no dejaría el camino en un callejón.
 */
export async function reemplazarPaso(
  caminoId: string,
  orden: number,
  identity: ListenerIdentity,
): Promise<boolean> {
  try {
    const camino = await getCamino(caminoId, identity);
    if (!camino || !hayClaveIA()) return false;

    const indice = camino.pasos.findIndex((p) => p.orden === orden);
    if (indice === -1) return false;
    const paso = camino.pasos[indice];
    // Un paso ya escuchado es historia del oyente: no se reescribe.
    if (paso.escuchadoAt) return false;

    const profile = await prisma.profile.findFirst({
      where: identity.userId
        ? { OR: [{ userId: identity.userId }, { deviceId: identity.deviceId }] }
        : { deviceId: identity.deviceId },
    });
    const parsedProfile = profile
      ? parseJson<Record<string, unknown>>(profile.answersJson, {})
      : null;

    const contexto = camino.pasos
      .map(
        (p) =>
          `- Paso ${p.orden} (${p.papel}): "${p.title}" de ${p.artist}${
            p.orden === orden ? "  ← ESTE ES EL QUE HAY QUE REEMPLAZAR" : ""
          }`,
      )
      .join("\n");

    const propuesta = await proponerCamino({
      tema: camino.tema,
      perfilTexto: perfilATexto(parsedProfile),
      diarioTexto: "(no hace falta para reemplazar un paso)",
      voz: curatorVoz(
        typeof parsedProfile?.curator === "string" ? parsedProfile.curator : undefined,
      ),
      soloPaso: {
        orden,
        papel: paso.papel,
        evitar: camino.pasos.map((p) => `"${p.title}" de ${p.artist}`),
        contexto,
      },
    });

    const nuevo = propuesta.pasos[0];
    if (!nuevo) return false;

    const pasos = camino.pasos.map((p) =>
      p.orden === orden
        ? {
            ...p,
            title: nuevo.title,
            artist: nuevo.artist,
            year: nuevo.year,
            puente: nuevo.puente || p.puente,
            albumId: null,
          }
        : p,
    );
    await guardarPasos(caminoId, pasos);
    return true;
  } catch (err) {
    console.error("[caminos] no se pudo reemplazar el paso:", err);
    return false;
  }
}

export async function borrarCamino(
  caminoId: string,
  identity: ListenerIdentity,
): Promise<boolean> {
  const camino = await getCamino(caminoId, identity);
  if (!camino) return false;
  await prisma.camino.delete({ where: { id: caminoId } });
  return true;
}
