// Fase 5.5 — Modo dueto: dos cuentas vinculadas, un disco a la semana en la
// intersección de gustos. Elige por scoring determinista; el LLM solo redacta
// el porqué. Si falla, hay texto de respaldo: la app nunca se cae.

import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { todayKey } from "./daily";
import { llm } from "./dossier/llm";
import { parseJson, type FactsPayload } from "./types";

const LLM_TIMEOUT_MS = 8_000;

export type ProfileAnswers = {
  moments: string[];
  seeks: string[];
  anchors: string;
  listenTime: string;
};

type DossierConAlbum = Prisma.DossierGetPayload<{
  include: { album: { include: { artist: true } } };
}>;

const SEEK_TAG_HINTS: Record<string, string[]> = {
  "La historia": ["historia", "legado", "cultura", "política", "época"],
  "La emoción": ["emoción", "sentimental", "intimista", "melancolía", "amor"],
  "La técnica": ["técnica", "complejo", "experimental", "virtuoso", "jazz"],
  "Descubrir lo nuevo": ["influencia", "pionero", "underground", "raro", "nuevo"],
};

/** Lunes de la semana (clave de caché semanal). */
export function weekKey(date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return todayKey(d);
}

export function weekLabel(wk: string): string {
  const start = new Date(`${wk}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function emptyProfile(): ProfileAnswers {
  return { moments: [], seeks: [], anchors: "", listenTime: "" };
}

function parseProfile(json: string): ProfileAnswers {
  const raw = parseJson<Partial<ProfileAnswers>>(json, {});
  return {
    moments: Array.isArray(raw.moments) ? raw.moments : [],
    seeks: Array.isArray(raw.seeks) ? raw.seeks : [],
    anchors: typeof raw.anchors === "string" ? raw.anchors : "",
    listenTime: typeof raw.listenTime === "string" ? raw.listenTime : "",
  };
}

function sharedLists(a: ProfileAnswers, b: ProfileAnswers) {
  return {
    moments: a.moments.filter((m) => b.moments.includes(m)),
    seeks: a.seeks.filter((s) => b.seeks.includes(s)),
  };
}

function hashIndex(seed: string, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return max > 0 ? h % max : 0;
}

function albumTagScore(dossier: DossierConAlbum, sharedSeeks: string[]): number {
  if (sharedSeeks.length === 0) return 0;
  const facts = parseJson<Partial<FactsPayload>>(dossier.album.factsJson, {});
  const tags = (facts.tags ?? []).map((t) => t.toLowerCase());
  if (tags.length === 0) return 0;
  let score = 0;
  for (const seek of sharedSeeks) {
    const hints = SEEK_TAG_HINTS[seek] ?? [seek.toLowerCase()];
    for (const hint of hints) {
      if (tags.some((t) => t.includes(hint) || hint.includes(t))) score += 2;
    }
  }
  return score;
}

function durationFits(
  dossier: DossierConAlbum,
  listenA: string,
  listenB: string,
): number {
  const min = dossier.album.durationMin;
  if (!min) return 0;
  const budgets: Record<string, number> = {
    "20 min": 25,
    "45 min": 50,
    "1 hora o más": 90,
  };
  const a = budgets[listenA];
  const b = budgets[listenB];
  if (!a && !b) return 0;
  const target = a && b ? Math.min(a, b) : (a ?? b)!;
  if (min <= target) return 2;
  if (min <= target + 15) return 1;
  return 0;
}

async function loadProfile(userId: string): Promise<ProfileAnswers> {
  const row = await prisma.profile.findFirst({ where: { userId } });
  return row ? parseProfile(row.answersJson) : emptyProfile();
}

async function lowRatedAlbumIds(userIds: string[]): Promise<Set<string>> {
  const rows = await prisma.review.findMany({
    where: { userId: { in: userIds }, rating: { lte: 2 } },
    select: { albumId: true },
  });
  return new Set(rows.map((r) => r.albumId));
}

function generateInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function findPairForUser(userId: string) {
  return prisma.duetPair.findFirst({
    where: {
      OR: [
        { userAId: userId, status: { in: ["pending", "active"] } },
        { userBId: userId, status: "active" },
      ],
    },
    include: {
      userA: { select: { id: true, name: true, email: true, image: true } },
      userB: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export type DuetSummary = {
  status: "none" | "pending" | "active";
  inviteCode?: string;
  partnerName?: string | null;
  partnerEmail?: string;
};

export async function getDuetSummary(userId: string): Promise<DuetSummary> {
  const pair = await findPairForUser(userId);
  if (!pair) return { status: "none" };

  if (pair.status === "pending" && pair.userAId === userId) {
    return { status: "pending", inviteCode: pair.inviteCode };
  }

  const partner = pair.userAId === userId ? pair.userB : pair.userA;
  return {
    status: "active",
    partnerName: partner?.name,
    partnerEmail: partner?.email,
  };
}

export async function createDuetInvite(userId: string): Promise<{ inviteCode: string }> {
  const existing = await findPairForUser(userId);
  if (existing?.status === "active") {
    throw new Error("Ya tienes un dueto activo");
  }
  if (existing?.status === "pending" && existing.userAId === userId) {
    return { inviteCode: existing.inviteCode };
  }
  if (existing) {
    throw new Error("Ya participas en un dueto");
  }

  let code = generateInviteCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.duetPair.findUnique({ where: { inviteCode: code } });
    if (!clash) break;
    code = generateInviteCode();
  }

  await prisma.duetPair.create({
    data: { inviteCode: code, userAId: userId, status: "pending" },
  });
  return { inviteCode: code };
}

export async function acceptDuetInvite(
  userId: string,
  code: string,
): Promise<{ ok: true }> {
  const normalized = code.trim().toUpperCase();
  if (normalized.length < 6) throw new Error("Código inválido");

  const pair = await prisma.duetPair.findUnique({ where: { inviteCode: normalized } });
  if (!pair || pair.status !== "pending") {
    throw new Error("Invitación no encontrada o ya usada");
  }
  if (pair.userAId === userId) {
    throw new Error("No puedes aceptar tu propia invitación");
  }

  const mine = await findPairForUser(userId);
  if (mine) throw new Error("Ya tienes un dueto o invitación pendiente");

  await prisma.duetPair.update({
    where: { id: pair.id },
    data: { userBId: userId, status: "active", activatedAt: new Date() },
  });
  return { ok: true };
}

export async function leaveDuet(userId: string): Promise<void> {
  const pair = await findPairForUser(userId);
  if (!pair) return;
  await prisma.duetPair.delete({ where: { id: pair.id } });
}

function fallbackReason(
  dossier: DossierConAlbum,
  shared: { moments: string[]; seeks: string[] },
  nameA: string,
  nameB: string,
): string {
  const title = dossier.album.title;
  const artist = dossier.album.artist.name;
  if (shared.seeks.length > 0) {
    return `Entre ${nameA} y ${nameB} coincidís en buscar ${shared.seeks.join(" y ")}. «${title}» de ${artist} cae justo en ese cruce — esta semana escuchadlo juntos.`;
  }
  if (shared.moments.length > 0) {
    return `Los dos escucháis sobre todo ${shared.moments[0].toLowerCase()}. «${title}» de ${artist} es el punto de encuentro de esta semana.`;
  }
  return `«${title}» de ${artist} es el disco compartido de esta semana para ${nameA} y ${nameB}. Abran el dossier y cuenten qué les hizo.`;
}

async function writeReason(input: {
  dossier: DossierConAlbum;
  profileA: ProfileAnswers;
  profileB: ProfileAnswers;
  shared: { moments: string[]; seeks: string[] };
  nameA: string;
  nameB: string;
}): Promise<string> {
  const { dossier, profileA, profileB, shared, nameA, nameB } = input;
  const facts = parseJson<Partial<FactsPayload>>(dossier.album.factsJson, {});
  const tags = facts.tags?.slice(0, 6).join(", ") ?? "";

  const system = `Eres la voz de Musicart en español. Explicas por qué un disco encaja para DOS oyentes en modo dueto.
REGLAS:
- Usa SOLO los datos dados (perfiles, coincidencias, metadatos del disco).
- 2-3 frases, tono cercano y melómano, segunda persona del plural ("ustedes" o "los dos").
- No inventes hechos del álbum ni de las personas.
- Menciona la intersección real de gustos si existe.`;

  const user = `Oyente A (${nameA}): momentos=${profileA.moments.join(", ") || "—"}; busca=${profileA.seeks.join(", ") || "—"}; tiempo=${profileA.listenTime || "—"}
Oyente B (${nameB}): momentos=${profileB.moments.join(", ") || "—"}; busca=${profileB.seeks.join(", ") || "—"}; tiempo=${profileB.listenTime || "—"}
Coincidencias: momentos=${shared.moments.join(", ") || "ninguna"}; busca=${shared.seeks.join(", ") || "ninguna"}

Disco elegido: «${dossier.album.title}» de ${dossier.album.artist.name} (${dossier.album.year})${tags ? `; etiquetas: ${tags}` : ""}

Escribe el porqué para los dos.`;

  const text = await llm({
    system,
    user,
    temperature: 0.65,
    maxTokens: 220,
    timeoutMs: LLM_TIMEOUT_MS,
  });
  const trimmed = text.trim();
  if (trimmed.length < 30) throw new Error("Razón demasiado corta");
  return trimmed.slice(0, 500);
}

async function pickAlbumForWeek(
  pairId: string,
  userAId: string,
  userBId: string,
  wk: string,
): Promise<{ dossier: DossierConAlbum; reason: string; shared: { moments: string[]; seeks: string[] } }> {
  const [profileA, profileB, catalogo, pastPicks, blocked] = await Promise.all([
    loadProfile(userAId),
    loadProfile(userBId),
    prisma.dossier.findMany({
      where: { status: "published", locale: "es" },
      include: { album: { include: { artist: true } } },
      orderBy: { id: "asc" },
    }),
    prisma.duetPick.findMany({
      where: { pairId },
      select: { albumId: true },
      orderBy: { weekKey: "desc" },
      take: 12,
    }),
    lowRatedAlbumIds([userAId, userBId]),
  ]);

  const shared = sharedLists(profileA, profileB);
  const usedIds = new Set(pastPicks.map((p) => p.albumId));

  const scored = catalogo
    .filter((d) => !usedIds.has(d.album.id) && !blocked.has(d.album.id))
    .map((d) => {
      let score = shared.moments.length * 3 + shared.seeks.length * 4;
      score += albumTagScore(d, shared.seeks);
      score += durationFits(d, profileA.listenTime, profileB.listenTime);
      return { dossier: d, score };
    })
    .sort((a, b) => b.score - a.score);

  const pool =
    scored.length > 0
      ? scored.filter((s) => s.score === scored[0]!.score).map((s) => s.dossier)
      : catalogo.filter((d) => !blocked.has(d.album.id));

  if (pool.length === 0) {
    throw new Error("Sin discos disponibles para el dueto");
  }

  const dossier = pool[hashIndex(`${pairId}:${wk}`, pool.length)]!;

  const pair = await prisma.duetPair.findUniqueOrThrow({
    where: { id: pairId },
    include: {
      userA: { select: { name: true, email: true } },
      userB: { select: { name: true, email: true } },
    },
  });

  const nameA = pair.userA.name ?? pair.userA.email.split("@")[0] ?? "tú";
  const nameB = pair.userB?.name ?? pair.userB?.email.split("@")[0] ?? "tu pareja";

  let reason: string;
  try {
    reason = await writeReason({
      dossier,
      profileA,
      profileB,
      shared,
      nameA,
      nameB,
    });
  } catch {
    reason = fallbackReason(dossier, shared, nameA, nameB);
  }

  return { dossier, reason, shared };
}

export type DuetWeeklyPick = {
  weekKey: string;
  weekLabel: string;
  dossier: DossierConAlbum;
  reason: string;
  sharedMoments: string[];
  sharedSeeks: string[];
  partner: { name: string | null; email: string; image: string | null };
};

export async function getWeeklyDuetPick(
  userId: string,
): Promise<DuetWeeklyPick | null> {
  const pair = await findPairForUser(userId);
  if (!pair || pair.status !== "active" || !pair.userBId) return null;

  const wk = weekKey();
  const partner = pair.userAId === userId ? pair.userB! : pair.userA;

  const cached = await prisma.duetPick.findUnique({
    where: { pairId_weekKey: { pairId: pair.id, weekKey: wk } },
    include: {
      album: { include: { artist: true } },
    },
  });

  if (cached) {
    const dossier = await prisma.dossier.findFirst({
      where: { albumId: cached.albumId, status: "published", locale: "es" },
      include: { album: { include: { artist: true } } },
    });
    if (!dossier) return null;
    const [profileA, profileB] = await Promise.all([
      loadProfile(pair.userAId),
      loadProfile(pair.userBId),
    ]);
    const shared = sharedLists(profileA, profileB);
    return {
      weekKey: wk,
      weekLabel: weekLabel(wk),
      dossier,
      reason: cached.reason ?? fallbackReason(dossier, shared, "vosotros", "los dos"),
      sharedMoments: shared.moments,
      sharedSeeks: shared.seeks,
      partner: {
        name: partner.name,
        email: partner.email,
        image: partner.image,
      },
    };
  }

  const { dossier, reason, shared } = await pickAlbumForWeek(
    pair.id,
    pair.userAId,
    pair.userBId,
    wk,
  );

  await prisma.duetPick.create({
    data: {
      pairId: pair.id,
      weekKey: wk,
      albumId: dossier.album.id,
      reason,
    },
  });

  return {
    weekKey: wk,
    weekLabel: weekLabel(wk),
    dossier,
    reason,
    sharedMoments: shared.moments,
    sharedSeeks: shared.seeks,
    partner: {
      name: partner.name,
      email: partner.email,
      image: partner.image,
    },
  };
}
