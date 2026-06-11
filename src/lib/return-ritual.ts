// Fase 5.6 — Racha con alma: si te alejas del ritual, el pick de regreso llega
// con cariño. Sin culpa, sin badges, sin contadores vacíos.

import { prisma } from "./db";
import { pastPicksWhere, type ListenerIdentity } from "./identity";

/** Mínimo de días sin pick para considerar un regreso. */
export const MIN_ABSENCE_DAYS = 4;

/** Ritual previo establecido (no es la primera visita). */
export const MIN_PRIOR_PICKS = 2;

export type ReturnRitual = {
  absenceDays: number;
  lastPickDate: string;
};

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Etiqueta humana de la ausencia (para UI y fallback). */
export function absenceLabel(days: number): string {
  if (days >= 30) return "mucho tiempo";
  if (days >= 14) return "unas semanas";
  if (days >= 7) return "una semana";
  return `${days} días`;
}

/**
 * ¿Es el primer pick tras una ausencia? null = ritual normal.
 * Solo aplica si ya tenía al menos MIN_PRIOR_PICKS anteriores.
 */
export async function detectReturnRitual(
  identity: ListenerIdentity,
  today: string,
): Promise<ReturnRitual | null> {
  const where = pastPicksWhere(identity, today);
  if (!where) return null;

  const picks = await prisma.dailyPick.findMany({
    where,
    orderBy: { date: "desc" },
    take: 30,
    select: { date: true },
  });

  if (picks.length < MIN_PRIOR_PICKS) return null;

  const lastPickDate = picks[0]!.date;
  const absenceDays = daysBetween(lastPickDate, today);
  if (absenceDays < MIN_ABSENCE_DAYS) return null;

  return { absenceDays, lastPickDate };
}

/** Razón de respaldo para el pick de regreso (sin LLM). */
export function fallbackReturnReason(
  absenceDays: number,
  title: string,
  artist: string,
): string {
  const span = absenceLabel(absenceDays);
  const tiempo =
    span === "mucho tiempo" || span === "unas semanas" || span === "una semana"
      ? `llevas ${span} sin pasar`
      : `llevas ${span} sin el ritual`;
  return `Sin prisa: ${tiempo}. Te guardé «${title}» de ${artist} para cuando volvieras — a tu ritmo.`;
}
