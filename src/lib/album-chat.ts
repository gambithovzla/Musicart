// Fase 5.3 — Conversar con el disco. Anti-abuso:
//   · Límites diarios (global + por álbum; Pro tiene más)
//   · Pregunta corta, sin historial largo (1 turno)
//   · Filtro de off-topic SIN llamar al LLM
//   · El LLM solo ve FactsPayload + intro; debe negarse si no es del disco

import { prisma } from "./db";
import { todayKey } from "./daily";
import { isAdminEmail } from "./admin";
import { llm } from "./dossier/llm";
import { isProUser, listenerKey } from "./freemium";
import type { ListenerIdentity } from "./identity";
import { parseJson, type FactsPayload } from "./types";

const MAX_QUESTION_CHARS = 240;
const MIN_QUESTION_CHARS = 8;

// Plan gratis: pocas preguntas. Pro: más. Admin: sin tope práctico.
const FREE_DAILY = 3;
const FREE_PER_ALBUM = 2;
const PRO_DAILY = 15;
const PRO_PER_ALBUM = 8;

/** Patrones que rechazamos sin gastar tokens (abuso obvio). */
const BLOCK_PATTERNS: RegExp[] = [
  /\b(código|code|python|javascript|typescript|sql|html|css)\b/i,
  /\b(traduce|translate|traducción|translation)\b/i,
  /\b(tarea|homework|ensayo|essay|trabajo universitario)\b/i,
  /\b(bitcoin|crypto|apuesta|forex|casino)\b/i,
  /\b(receta|recipe|ingredientes)\b/i,
  /\b(ignora|ignore)\s+(las\s+)?instrucciones/i,
  /\b(actúa como|pretend you|roleplay|jailbreak)\b/i,
  /\b(otro álbum|another album|diferente disco)\b/i,
  /\b(qué hora|weather|clima|noticias de hoy)\b/i,
  /https?:\/\//i,
];

export type ChatQuota = {
  remainingToday: number;
  remainingAlbum: number;
  limitToday: number;
  limitAlbum: number;
  isPro: boolean;
};

function limits(isPro: boolean, isAdmin: boolean) {
  if (isAdmin) return { daily: 999, perAlbum: 999 };
  if (isPro) return { daily: PRO_DAILY, perAlbum: PRO_PER_ALBUM };
  return { daily: FREE_DAILY, perAlbum: FREE_PER_ALBUM };
}

export async function getChatQuota(
  identity: ListenerIdentity,
  albumId: string,
  email?: string | null,
): Promise<ChatQuota | null> {
  const key = listenerKey(identity);
  if (!key) return null;

  const isAdmin = isAdminEmail(email);
  const isPro =
    isAdmin || (identity.userId ? await isProUser(identity.userId) : false);
  const { daily, perAlbum } = limits(isPro, isAdmin);
  const dateKey = todayKey();

  const [todayCount, albumCount] = await Promise.all([
    prisma.dossierChat.count({ where: { listenerKey: key, dateKey } }),
    prisma.dossierChat.count({
      where: { listenerKey: key, albumId, dateKey },
    }),
  ]);

  return {
    remainingToday: Math.max(0, daily - todayCount),
    remainingAlbum: Math.max(0, perAlbum - albumCount),
    limitToday: daily,
    limitAlbum: perAlbum,
    isPro,
  };
}

function validateQuestion(text: string): string | null {
  const q = text.trim();
  if (q.length < MIN_QUESTION_CHARS) {
    return "Escribe una pregunta un poco más larga.";
  }
  if (q.length > MAX_QUESTION_CHARS) {
    return `Máximo ${MAX_QUESTION_CHARS} caracteres.`;
  }
  for (const re of BLOCK_PATTERNS) {
    if (re.test(q)) {
      return "Solo puedo hablar de este disco y su historia — no de otros temas.";
    }
  }
  return null;
}

function compactFacts(payload: FactsPayload): string {
  const lines: string[] = [
    `Álbum: «${payload.album.title}» (${payload.album.year}) — ${payload.album.artist}`,
  ];
  if (payload.album.label) lines.push(`Sello: ${payload.album.label}`);
  if (payload.tracklist.length) {
    lines.push(
      `Temas: ${payload.tracklist.map((t) => `${t.position}. ${t.title}`).join("; ")}`,
    );
  }
  for (const f of payload.facts.slice(0, 40)) {
    lines.push(`• ${f.fact}`);
  }
  for (const p of payload.passages?.slice(0, 2) ?? []) {
    lines.push(`[${p.source}] ${p.text.slice(0, 400)}`);
  }
  return lines.join("\n").slice(0, 5500);
}

export type AskResult =
  | { ok: true; answer: string; quota: ChatQuota }
  | { ok: false; error: string; quota?: ChatQuota };

export async function askAlbumQuestion(
  identity: ListenerIdentity,
  albumId: string,
  question: string,
  email?: string | null,
): Promise<AskResult> {
  const key = listenerKey(identity);
  if (!key) {
    return { ok: false, error: "No pudimos identificar tu dispositivo." };
  }

  const quota = await getChatQuota(identity, albumId, email);
  if (!quota) {
    return { ok: false, error: "No pudimos identificar tu dispositivo." };
  }
  if (quota.remainingToday <= 0) {
    return {
      ok: false,
      error: quota.isPro
        ? "Llegaste al límite de preguntas de hoy. Mañana seguimos."
        : "Límite de preguntas de hoy alcanzado. Con Pro tienes más, o vuelve mañana.",
      quota,
    };
  }
  if (quota.remainingAlbum <= 0) {
    return {
      ok: false,
      error: "Ya hiciste todas las preguntas de este disco hoy. Explora otro o vuelve mañana.",
      quota,
    };
  }

  const validationError = validateQuestion(question);
  if (validationError) {
    return { ok: false, error: validationError, quota };
  }

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    include: {
      artist: true,
      dossiers: {
        where: { locale: "es", status: "published" },
        take: 1,
      },
    },
  });
  const dossier = album?.dossiers[0];
  if (!album || !dossier) {
    return { ok: false, error: "Dossier no encontrado." };
  }

  const facts = parseJson<FactsPayload>(album.factsJson, {
    album: {
      title: album.title,
      artist: album.artist.name,
      year: album.year,
    },
    tracklist: [],
    facts: [],
    sources: [],
  });

  const factsBlock = compactFacts(facts);
  const introSnippet = dossier.intro.slice(0, 600);

  const system = `Eres el guía de Musicart sobre UN solo disco.
REGLAS ESTRICTAS:
1. Responde SOLO preguntas sobre «${album.title}» de ${album.artist.name}, su grabación, contexto, canciones o carrera del artista EN RELACIÓN con este disco.
2. Usa ÚNICAMENTE los HECHOS VERIFICADOS abajo. Si no está en los hechos, di "No tengo ese dato verificado sobre este disco."
3. Si la pregunta no es sobre este disco/artista, responde EXACTAMENTE: "Solo puedo hablar de este disco. ¿Algo sobre «${album.title}»?"
4. Máximo 120 palabras, español cercano, sin listas largas.
5. Nunca escribas código, traducciones, consejos ajenos a la música ni hables de otros álbumes.`;

  const user = `HECHOS VERIFICADOS:
${factsBlock}

Resumen editorial (solo contexto, no inventes más allá de los hechos):
${introSnippet}

Pregunta del oyente:
${question.trim()}`;

  let answer: string;
  try {
    answer = (
      await llm({
        system,
        user,
        temperature: 0.35,
        maxTokens: 280,
        timeoutMs: 8_000,
      })
    ).trim();
  } catch {
    return {
      ok: false,
      error: "No pude responder ahora. Inténtalo en un momento.",
      quota,
    };
  }

  if (!answer) {
    return { ok: false, error: "Respuesta vacía. Reformula la pregunta.", quota };
  }

  await prisma.dossierChat.create({
    data: {
      listenerKey: key,
      albumId,
      dateKey: todayKey(),
      question: question.trim().slice(0, MAX_QUESTION_CHARS),
    },
  });

  const newQuota = await getChatQuota(identity, albumId, email);
  return {
    ok: true,
    answer,
    quota: newQuota ?? quota,
  };
}
