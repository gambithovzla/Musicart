// Memoria personal del oyente + respuesta del melómano.
//
// Dos caminos, como pidió el dueño:
//   1) GRATIS — guardarNota(): el oyente le cuenta algo al curador ("esta canción
//      me fascina") y se guarda en su memoria. NO llama a la IA → no cuesta. Esa
//      memoria entra en el prompt del disco diario para conocerlo cada vez mejor.
//   2) CON COSTO — responderMelomano(): además de guardar la nota, la IA responde
//      como el mayor melómano del mundo, valida su gusto y le sugiere otra música.
//      Reusa el MISMO límite del chat del dossier (getChatQuota): gratis con tope,
//      más con Pro, admin sin tope práctico.

import { prisma } from "./db";
import { todayKey } from "./daily";
import { llm } from "./dossier/llm";
import { getChatQuota, type ChatQuota } from "./album-chat";
import { findProfileRecord, type ListenerIdentity } from "./identity";
import { listenerKey } from "./freemium";
import { parseJson } from "./types";

const MAX_NOTE_CHARS = 280;
const MIN_NOTE_CHARS = 3;
const MAX_NOTAS_PROMPT = 14;

/** Patrones de abuso obvio que cortamos sin gastar tokens. */
const BLOCK_PATTERNS: RegExp[] = [
  /\b(código|code|python|javascript|typescript|sql|html|css)\b/i,
  /\b(traduce|translate|traducción)\b/i,
  /\b(ignora|ignore)\s+(las\s+)?instrucciones/i,
  /\b(jailbreak|actúa como|pretend you)\b/i,
  /https?:\/\//i,
];

/** Filtro de notas del oyente (por cuenta o por dispositivo). */
function notesWhere(identity: ListenerIdentity) {
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

function validarNota(text: string): string | null {
  const t = text.trim();
  if (t.length < MIN_NOTE_CHARS) return "Escribe un poco más para que te entienda.";
  if (t.length > MAX_NOTE_CHARS) return `Máximo ${MAX_NOTE_CHARS} caracteres.`;
  return null;
}

/**
 * Guarda una nota en la memoria del oyente. Camino GRATIS (no llama a la IA).
 * `source`: "free" cuando solo guarda; "chat" cuando además pidió respuesta.
 */
export async function guardarNota(
  identity: ListenerIdentity,
  input: {
    albumId: string | null;
    albumTitle: string | null;
    albumArtist: string | null;
    text: string;
    source?: "free" | "chat";
  },
): Promise<{ ok: boolean; error?: string }> {
  if (!identity.userId && !identity.deviceId) {
    return { ok: false, error: "No pudimos identificar tu dispositivo." };
  }
  const error = validarNota(input.text);
  if (error) return { ok: false, error };

  await prisma.listenerNote.create({
    data: {
      deviceId: identity.deviceId || null,
      userId: identity.userId,
      albumId: input.albumId,
      albumTitle: input.albumTitle,
      albumArtist: input.albumArtist,
      text: input.text.trim().slice(0, MAX_NOTE_CHARS),
      source: input.source ?? "free",
    },
  });
  return { ok: true };
}

/**
 * Texto de la memoria del oyente para el prompt del disco diario. Las notas más
 * recientes primero (son las que más pesan). Devuelve null si no hay ninguna.
 */
export async function cargarNotasTexto(
  identity: ListenerIdentity,
): Promise<string | null> {
  const where = notesWhere(identity);
  if (!where) return null;

  const notas = await prisma.listenerNote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_NOTAS_PROMPT,
    select: { text: true, albumTitle: true, albumArtist: true },
  });
  if (notas.length === 0) return null;

  const lineas = notas.map((n) => {
    const ctx =
      n.albumTitle && n.albumArtist
        ? `Sobre "${n.albumTitle}" de ${n.albumArtist}`
        : "En general";
    return `- ${ctx}: «${n.text}»`;
  });
  return `LO QUE TE HA CONTADO DE SU ESCUCHA (memoria personal — afínate con esto, son sus palabras reales):\n${lineas.join("\n")}`;
}

export type MelomanoResult =
  | { ok: true; answer: string; quota: ChatQuota }
  | { ok: false; error: string; quota?: ChatQuota };

/**
 * Respuesta del melómano. Camino CON COSTO: además de guardar la nota, la IA
 * responde con feedback experto y le sugiere otra música. Reusa el límite del
 * chat del dossier (getChatQuota). A diferencia del chat del dossier (atado a UN
 * disco), aquí SÍ puede recomendar otros artistas — es justo lo que se pide. Para
 * cuidar la regla anti-alucinación, puede nombrar música real y decir por qué
 * conecta, pero NO inventa datos (fechas, anécdotas, cifras) de esos discos.
 */
export async function responderMelomano(
  identity: ListenerIdentity,
  input: {
    albumId: string;
    albumTitle: string;
    albumArtist: string;
    text: string;
  },
  email?: string | null,
): Promise<MelomanoResult> {
  if (!identity.userId && !identity.deviceId) {
    return { ok: false, error: "No pudimos identificar tu dispositivo." };
  }

  const validation = validarNota(input.text);
  if (validation) return { ok: false, error: validation };
  for (const re of BLOCK_PATTERNS) {
    if (re.test(input.text)) {
      return { ok: false, error: "Háblame de música y de lo que sientes al escucharla." };
    }
  }

  const quota = await getChatQuota(identity, input.albumId, email);
  if (!quota) return { ok: false, error: "No pudimos identificar tu dispositivo." };
  if (quota.remainingToday <= 0) {
    return {
      ok: false,
      error: quota.isPro
        ? "Llegaste al límite de hoy. Mañana seguimos charlando."
        : "Límite de respuestas de hoy alcanzado. Con Pro tienes más, o vuelve mañana. (Guardar tu comentario siempre es gratis.)",
      quota,
    };
  }

  // Perfil del oyente (resumen corto) para que la respuesta sea a su medida.
  const profile = await findProfileRecord(identity);
  const resumenPerfil = profile ? resumirPerfil(profile.answersJson) : "";

  const system = `Eres el curador de Musicart: el mayor melómano del mundo, cercano y generoso. Hablas español, de "tú".
El oyente acaba de contarte qué sintió con una canción o disco. Tu trabajo:
1. Reacciona con calidez y criterio de experto a lo que te dijo (valida o matiza su gusto, sin peloteo vacío).
2. Sugiérele 1 o 2 canciones o artistas REALES que le pueden volar la cabeza por ESA misma razón (esa energía, esa emoción, esa escena). Di en una frase por qué conectan.
REGLAS:
- Máximo 110 palabras. Nada de listas largas ni encabezados. Tono de amigo melómano, no de Wikipedia.
- Recomienda solo música que exista de verdad. PROHIBIDO inventar datos (fechas, ventas, anécdotas, nombres de discos que no existan). Si no estás seguro de un dato, no lo des: habla de la sensación, no del dato.
- Quédate en la música. Si te escribe de otra cosa, redirígelo con cariño a lo musical.`;

  const user = `${resumenPerfil ? `LO QUE SÉ DEL OYENTE:\n${resumenPerfil}\n\n` : ""}DISCO QUE ESTÁ ESCUCHANDO: «${input.albumTitle}» de ${input.albumArtist}

LO QUE TE ACABA DE DECIR:
«${input.text.trim()}»

Respóndele ahora.`;

  let answer: string;
  try {
    answer = (
      await llm({
        system,
        user,
        temperature: 0.7,
        maxTokens: 260,
        timeoutMs: 9_000,
      })
    ).trim();
  } catch {
    return {
      ok: false,
      error: "No pude responderte ahora. Inténtalo en un momento. (Tu comentario sí lo puedo guardar gratis.)",
      quota,
    };
  }
  if (!answer) {
    return { ok: false, error: "Respuesta vacía. Reformula tu comentario.", quota };
  }

  // Guardamos la nota (también alimenta la memoria) y registramos el uso del chat
  // (cuenta contra el mismo límite del dossier).
  await Promise.all([
    guardarNota(identity, {
      albumId: input.albumId,
      albumTitle: input.albumTitle,
      albumArtist: input.albumArtist,
      text: input.text,
      source: "chat",
    }),
    prisma.dossierChat.create({
      data: {
        listenerKey: listenerKey(identity)!,
        albumId: input.albumId,
        dateKey: todayKey(),
        question: input.text.trim().slice(0, MAX_NOTE_CHARS),
      },
    }),
  ]);

  const newQuota = await getChatQuota(identity, input.albumId, email);
  return { ok: true, answer, quota: newQuota ?? quota };
}

/** Resumen corto del perfil (géneros, artistas, lo que busca) para el prompt. */
function resumirPerfil(answersJson: string): string {
  const p = parseJson<Record<string, unknown>>(answersJson, {});
  const lista = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const generos = [...lista(p.genres), ...lista(p.spotifyGenres)];
  const artistas = [...lista(p.artists), ...lista(p.spotifyArtists)].slice(0, 8);
  const busca = lista(p.seeks);
  const lineas = [
    generos.length ? `Géneros: ${generos.join(", ")}` : null,
    artistas.length ? `Artistas que ama: ${artistas.join(", ")}` : null,
    busca.length ? `Busca en un disco: ${busca.join(", ")}` : null,
  ].filter(Boolean);
  return lineas.join("\n");
}
