// La pieza del día (Fase 12.7): Musicart como redacción de Panteón.
//
// Cada día, UNA pieza vertical para la cuenta de TikTok que lleva Efesto en
// Panteón (Hexa Oracle: deporte y música). El orden es:
//
//   1. el curador propone un disco real con buena historia y el pipeline lo
//      fabrica con su dossier verificado (como el disco del día de un oyente);
//   2. el editor social lo convierte en guion de 25-40 s, que pasa otra vez por
//      el verificador (si no lo pasa, la pieza queda BLOQUEADA y ese día no hay
//      video: nunca se publica algo sin verificar);
//   3. si los hechos están limpios se aprueba sola para la imprenta — la
//      aprobación humana es la de Telegram, sobre el video ya hecho, en Panteón;
//   4. se graba la voz (aquí, que es donde vive la clave de TTS);
//   5. la laptop de Panteón la imprime a MP4 con scripts/social-local.ts.
//
// Fabricar un disco tarda 1-3 min y una ruta de Vercel corta a los 300 s, así
// que esto AVANZA por pasos: cada llamada hace lo que le cabe en su reloj y
// devuelve en qué punto quedó. Quien llama vuelve a llamar hasta "lista".
//
// Sin migración: la pieza del día es un SocialContent con format
// "pieza_del_dia" (Preview y Producción comparten base, ver CLAUDE.md), y
// "preparing" es el estado de una pieza con disco pero aún sin guion.

import { prisma } from "@/lib/db";
import { todayKey } from "@/lib/daily";
import { hayPresupuestoHoy, registrarGeneracion } from "@/lib/budget";
import { proponerDiscoDescubrimiento } from "@/lib/discover";
import { runDossierPipeline } from "@/lib/dossier/pipeline";
import { synthesizeSpeech } from "@/lib/tts";
import { parseJson } from "@/lib/types";
import { generateSocialContent } from "./generate";
import { saveSocialAudio } from "./storage";
import {
  socialPlanSchema,
  type SocialRenderProps,
  type SocialVerification,
} from "./types";

export const FORMATO_DIA = "pieza_del_dia";

// La cuenta vive en Perú: el "día" de la pieza es el de Lima (UTC-5, sin
// horario de verano), no el del servidor de Vercel.
const ZONA = "America/Lima";
const OFFSET_LIMA = "-05:00";

// Lo que se reserva para cada paso. Si no cabe, se devuelve el estado y la
// siguiente llamada sigue: mejor una llamada más que una ruta cortada a medias.
const MIN_FABRICAR_MS = 150_000;
const MIN_GUION_MS = 100_000;
const MIN_VOZ_MS = 40_000;
const MAX_PROPUESTAS = 2;

const AUDIENCIA = `No es un oyente concreto: es la AUDIENCIA de una cuenta de TikTok en español (Hexa Oracle) que mezcla deporte y música, sobre todo de Latinoamérica.
Buscamos un disco cuya historia se pueda contar en 30 segundos y enganche en los primeros 3: un dato raro, un conflicto, una apuesta, un giro, una época dura, un récord.
Varía mucho de un día a otro: género, década, país (incluida Latinoamérica y España), idioma. Clásicos conocidos o discos de culto, pero SIEMPRE álbumes de estudio reales y bien documentados.
Si el disco tiene un cruce real con el deporte (un himno de estadio, un artista que fue deportista, un disco ligado a un Mundial), mejor; pero no lo fuerces.`;

export type EstadoPieza =
  | "sin-pieza" // hoy aún no se empezó
  | "en-preparacion" // ya tiene disco; falta el guion o la voz: vuelve a llamar
  | "por-aprobar" // guion limpio pero sin aprobar (aprobar: false)
  | "lista-para-imprimir" // aprobada y con voz: la laptop puede renderizar
  | "imprimiendo"
  | "video-listo"
  | "bloqueada" // no pasó la verificación: hoy no sale video
  | "fallo-imprenta"
  | "retirada";

export type PiezaDelDia = {
  estado: EstadoPieza;
  /** Qué hacer ahora, dicho para el agente que llama. */
  siguiente: string;
  fecha: string;
  pieza: {
    id: string;
    disco: string;
    artista: string;
    anio: number;
    hook: string;
    guion: string;
    caption: string;
    portada: string | null;
    fuentes: string[];
    videoUrl: string | null;
    notasVerificacion: string[];
    error: string | null;
    /** Todo lo que necesita la imprenta para hacer el MP4. */
    render: SocialRenderProps | null;
  } | null;
  /** Lo que pasó en esta llamada, paso a paso (para el registro del agente). */
  bitacora: string[];
};

function inicioDelDia(fecha: string): Date {
  return new Date(`${fecha}T00:00:00${OFFSET_LIMA}`);
}

export function fechaDeHoy(): string {
  return todayKey(ZONA);
}

async function piezaDeHoy(fecha: string) {
  return prisma.socialContent.findFirst({
    where: {
      format: FORMATO_DIA,
      createdAt: { gte: inicioDelDia(fecha) },
      status: { not: "archived" },
    },
    orderBy: { createdAt: "desc" },
    include: { dossier: { include: { album: { include: { artist: true } } } } },
  });
}

type Pieza = NonNullable<Awaited<ReturnType<typeof piezaDeHoy>>>;

/** Discos que ya salieron en redes (nunca se repiten) y artistas recientes. */
async function memoriaSocial() {
  const usadas = await prisma.socialContent.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { dossier: { select: { album: { select: { title: true, artist: { select: { name: true } } } } } } },
  });
  const obras = usadas.map((u) => `${u.dossier.album.title} — ${u.dossier.album.artist.name}`);
  const artistas = [...new Set(usadas.slice(0, 20).map((u) => u.dossier.album.artist.name))];
  return { obras, artistas };
}

async function yaSalioEnRedes(albumId: string): Promise<boolean> {
  const n = await prisma.socialContent.count({ where: { dossier: { albumId } } });
  return n > 0;
}

/**
 * Elige y fabrica el disco de hoy. Si la IA o el tope de gasto no dejan, tira
 * de un disco ya publicado que nunca salió en redes (la app nunca se cae por la
 * IA: ese día el video sale igual, de catálogo).
 */
async function elegirDisco(
  fecha: string,
  restanteMs: () => number,
  log: (m: string) => void,
): Promise<string | null> {
  if (!(await hayPresupuestoHoy(fecha, "extra"))) {
    log("El tope de gasto de hoy no deja fabricar un disco nuevo: uso uno del catálogo.");
  } else {
    const { obras, artistas } = await memoriaSocial();
    const rechazados: string[] = [];
    for (let i = 0; i < MAX_PROPUESTAS && restanteMs() > MIN_FABRICAR_MS; i++) {
      let propuesta;
      try {
        propuesta = await proponerDiscoDescubrimiento({
          perfilTexto: AUDIENCIA,
          diarioTexto: "(no aplica: es una cuenta de redes, no un oyente)",
          recientesTexto: obras.slice(0, 40).map((o) => `- ${o}`).join("\n") || "(ninguno)",
          yaConoce: [...obras, ...rechazados],
          mood: null,
          lang: null,
          esRegreso: false,
          diasAusente: null,
          artistasRecientes: artistas,
        });
      } catch (err) {
        log(`El curador no respondió (${(err as Error).message}).`);
        break;
      }
      log(`El curador propone «${propuesta.title}» de ${propuesta.artist}.`);
      try {
        const result = await runDossierPipeline(propuesta.title, propuesta.artist, {
          publish: true,
          presupuestoMs: Math.max(70_000, restanteMs() - 25_000),
        });
        if (!result.reused) await registrarGeneracion(fecha);
        if (result.status !== "published") {
          log("No pasó la verificación (quedó en borrador): pido otro.");
          rechazados.push(`${propuesta.title} — ${propuesta.artist}`);
          continue;
        }
        if (await yaSalioEnRedes(result.albumId)) {
          log("Ese disco ya salió en redes otro día: pido otro.");
          rechazados.push(`${propuesta.title} — ${propuesta.artist}`);
          continue;
        }
        log(result.reused ? "Ya estaba en el catálogo: no costó nada." : "Disco fabricado y verificado.");
        return result.dossierId;
      } catch (err) {
        log(`No lo pude investigar (${(err as Error).message}).`);
        rechazados.push(`${propuesta.title} — ${propuesta.artist}`);
      }
    }
  }

  const deCatalogo = await prisma.dossier.findFirst({
    where: { status: "published", locale: "es", socialContents: { none: {} } },
    // Dossier no guarda fecha; el cuid crece con el tiempo, así que el id más
    // alto es aproximadamente el más reciente.
    orderBy: { id: "desc" },
    select: { id: true, album: { select: { title: true } } },
  });
  if (deCatalogo) log(`Uso «${deCatalogo.album.title}», del catálogo, que nunca salió en redes.`);
  else log("No hay ningún disco del catálogo sin estrenar en redes.");
  return deCatalogo?.id ?? null;
}

function estadoDe(p: Pieza): EstadoPieza {
  switch (p.status) {
    case "preparing":
      return "en-preparacion";
    case "draft":
      return "por-aprobar";
    case "approved":
      return p.audioUrl ? "lista-para-imprimir" : "en-preparacion";
    case "rendering":
      return "imprimiendo";
    case "ready":
      return "video-listo";
    case "blocked":
      return "bloqueada";
    case "failed":
      return "fallo-imprenta";
    default:
      return "retirada";
  }
}

const SIGUIENTE: Record<EstadoPieza, string> = {
  "sin-pieza": "Vuelve a llamar con accion «avanzar» para empezar la pieza de hoy.",
  "en-preparacion": "Falta un paso (guion o voz). Vuelve a llamar con accion «avanzar».",
  "por-aprobar": "El guion está verificado pero sin aprobar. Llama con accion «avanzar» y aprobar: true.",
  "lista-para-imprimir": "Imprime el MP4 con `npm run social:local` (o con los datos de «render») y luego mándalo a Telegram para aprobación.",
  imprimiendo: "La imprenta está trabajando. Si lleva más de 15 min, avisa al dueño.",
  "video-listo": "El video de hoy ya está hecho. Si no se ha publicado, pásalo por la aprobación de Telegram.",
  bloqueada: "La pieza no pasó la verificación de hechos: HOY NO SE PUBLICA. Avisa al dueño (puede rehacerla).",
  "fallo-imprenta": "Falló la impresión del MP4. Reintenta `npm run social:local`; si vuelve a fallar, avisa al dueño.",
  retirada: "La pieza fue retirada. Llama con rehacer: true para empezar otra.",
};

/** Convierte una URL relativa de la app en absoluta (la laptop no está en Vercel). */
function absoluta(url: string | null | undefined, origen?: string): string | null {
  if (!url) return null;
  if (/^https?:\/\//.test(url) || !origen) return url;
  try {
    return new URL(url, origen).toString();
  } catch {
    return url;
  }
}

function propsDeRender(p: Pieza, origen?: string): SocialRenderProps | null {
  if (!p.script) return null;
  const escenas = parseJson<{ durationSec?: number; scenes?: unknown[] }>(p.scenesJson, {});
  const plan = socialPlanSchema.safeParse({
    hook: p.hook,
    script: p.script,
    caption: p.caption,
    durationSec: escenas.durationSec,
    scenes: escenas.scenes,
  });
  if (!plan.success) return null;
  return {
    ...plan.data,
    albumTitle: p.dossier.album.title,
    artistName: p.dossier.album.artist.name,
    year: p.dossier.album.year,
    audioUrl: absoluta(p.audioUrl, origen),
    coverUrl: absoluta(p.dossier.album.coverUrl, origen),
    folio: p.id.slice(-6).toUpperCase(),
  };
}

export function describirPieza(
  p: Pieza | null,
  fecha: string,
  bitacora: string[],
  origen?: string,
): PiezaDelDia {
  if (!p) {
    return { estado: "sin-pieza", siguiente: SIGUIENTE["sin-pieza"], fecha, pieza: null, bitacora };
  }
  const estado = estadoDe(p);
  const verif = parseJson<SocialVerification | null>(p.verificationJson, null);
  const facts = parseJson<{ sources?: string[] } | null>(p.factsSnapshotJson, null);
  return {
    estado,
    siguiente: SIGUIENTE[estado],
    fecha,
    bitacora,
    pieza: {
      id: p.id,
      disco: p.dossier.album.title,
      artista: p.dossier.album.artist.name,
      anio: p.dossier.album.year,
      hook: p.hook,
      guion: p.script,
      caption: p.caption,
      portada: absoluta(p.dossier.album.coverUrl, origen),
      fuentes: facts?.sources ?? [],
      videoUrl: absoluta(p.videoUrl, origen),
      notasVerificacion: [...(verif?.hardErrors ?? []), ...(verif?.unsupportedClaims ?? [])],
      error: p.error,
      // Solo se entregan los datos de imprenta cuando de verdad se puede imprimir.
      render: estado === "lista-para-imprimir" || estado === "fallo-imprenta" || estado === "video-listo"
        ? propsDeRender(p, origen)
        : null,
    },
  };
}

export async function consultarPiezaDelDia(origen?: string): Promise<PiezaDelDia> {
  const fecha = fechaDeHoy();
  return describirPieza(await piezaDeHoy(fecha), fecha, [], origen);
}

/**
 * Avanza la pieza de hoy todo lo que quepa en `presupuestoMs`.
 * - `aprobar` (por defecto true): un guion con los hechos limpios pasa solo a
 *   la imprenta. La aprobación humana es la de Telegram, sobre el video.
 * - `rehacer`: retira la pieza de hoy (si la hay) y empieza otra.
 */
export async function avanzarPiezaDelDia(opciones: {
  presupuestoMs?: number;
  aprobar?: boolean;
  rehacer?: boolean;
  origen?: string;
} = {}): Promise<PiezaDelDia> {
  const arranque = Date.now();
  const presupuesto = opciones.presupuestoMs ?? 270_000;
  const restanteMs = () => presupuesto - (Date.now() - arranque);
  const aprobar = opciones.aprobar ?? true;
  const fecha = fechaDeHoy();
  const bitacora: string[] = [];
  const log = (m: string) => {
    bitacora.push(m);
    console.log(`[pieza-del-dia] ${m}`);
  };

  if (opciones.rehacer) {
    const actual = await piezaDeHoy(fecha);
    if (actual && actual.status !== "rendering") {
      await prisma.socialContent.update({ where: { id: actual.id }, data: { status: "archived" } });
      log("Retiré la pieza de hoy para hacer otra.");
    }
  }

  // Cada vuelta da UN paso y relee el estado: así un fallo a medias nunca deja
  // la pieza en un estado que esta función no sepa continuar.
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const p = await piezaDeHoy(fecha);

    if (!p) {
      if (restanteMs() < MIN_FABRICAR_MS) break;
      const dossierId = await elegirDisco(fecha, restanteMs, log);
      if (!dossierId) {
        log("Hoy no encontré disco para la pieza.");
        break;
      }
      await prisma.socialContent.create({
        data: { dossierId, format: FORMATO_DIA, status: "preparing", hook: "", script: "", caption: "" },
      });
      continue;
    }

    if (p.status === "preparing") {
      if (restanteMs() < MIN_GUION_MS) break;
      try {
        const hecha = await generateSocialContent(p.dossierId, { contentId: p.id });
        log(hecha.status === "draft"
          ? "Guion escrito y verificado."
          : "El guion no pasó la verificación: la pieza queda bloqueada.");
      } catch (err) {
        log(`El editor de guiones falló (${(err as Error).message}).`);
        break;
      }
      continue;
    }

    if (p.status === "draft") {
      const verif = parseJson<SocialVerification | null>(p.verificationJson, null);
      if (!aprobar || !verif?.ok || p.rightsStatus !== "clear") break;
      await prisma.socialContent.update({ where: { id: p.id }, data: { status: "approved", error: null } });
      log("Hechos limpios: aprobada para la imprenta.");
      continue;
    }

    if (p.status === "approved" && !p.audioUrl) {
      if (restanteMs() < MIN_VOZ_MS) break;
      try {
        const audioUrl = await saveSocialAudio(p.id, await synthesizeSpeech(p.script));
        await prisma.socialContent.update({ where: { id: p.id }, data: { audioUrl } });
        log("Voz grabada.");
      } catch (err) {
        log(`No pude grabar la voz (${(err as Error).message}).`);
        break;
      }
      continue;
    }

    break; // lista, imprimiendo, lista o bloqueada: nada más que hacer aquí
  }

  return describirPieza(await piezaDeHoy(fecha), fecha, bitacora, opciones.origen);
}

/** La imprenta (laptop) avisa de cómo le fue. */
export async function marcarImpresion(input: {
  id: string;
  estado: "imprimiendo" | "impreso" | "fallo";
  videoUrl?: string | null;
  error?: string | null;
}): Promise<PiezaDelDia> {
  const p = await prisma.socialContent.findUnique({ where: { id: input.id } });
  if (!p || p.format !== FORMATO_DIA) throw new Error("Esa pieza no existe o no es una pieza del día.");
  const permitido: Record<typeof input.estado, string[]> = {
    imprimiendo: ["approved", "failed", "ready"],
    impreso: ["rendering", "approved", "failed"],
    fallo: ["rendering", "approved"],
  };
  if (!permitido[input.estado].includes(p.status)) {
    throw new Error(`La pieza está en estado ${p.status}; no puede pasar a ${input.estado}.`);
  }
  const data =
    input.estado === "imprimiendo"
      ? { status: "rendering", error: null }
      : input.estado === "impreso"
      ? { status: "ready", error: null, videoUrl: input.videoUrl ?? p.videoUrl }
      : { status: "failed", error: (input.error ?? "La imprenta falló sin decir por qué.").slice(0, 1000) };
  await prisma.socialContent.update({ where: { id: p.id }, data });
  const fecha = fechaDeHoy();
  const actual = await prisma.socialContent.findUnique({
    where: { id: p.id },
    include: { dossier: { include: { album: { include: { artist: true } } } } },
  });
  return describirPieza(actual, fecha, []);
}
