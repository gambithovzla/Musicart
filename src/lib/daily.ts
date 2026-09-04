// Rotación determinista global sobre los dossiers publicados.
// Desde la Fase 1 es el fallback del pick personalizado (src/lib/recommend.ts):
// usuarios sin señales, o cualquier fallo de la IA, caen aquí. Nunca se rompe.

import { prisma } from "./db";

export function todayKey(tzOrDate?: string | null | Date): string {
  // Si recibe un Date, formatea esa fecha concreta (usos de analytics/duet)
  if (tzOrDate instanceof Date) {
    const y = tzOrDate.getFullYear();
    const m = String(tzOrDate.getMonth() + 1).padStart(2, "0");
    const d = String(tzOrDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const now = new Date();
  if (tzOrDate) {
    try {
      // en-CA produce el formato YYYY-MM-DD que necesitamos
      return new Intl.DateTimeFormat("en-CA", { timeZone: tzOrDate }).format(now);
    } catch {
      // timezone inválido → cae al UTC del servidor
    }
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDateEs(tz?: string | null): string {
  const now = new Date();
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(tz ? { timeZone: tz } : {}),
  }).format(now);
}

/** Elige un elemento determinista de una lista según la fecha: mismo día =
 *  mismo elemento para todo el mundo; cambia solo cuando cambia el día. La
 *  lista debe llegar en un orden estable (mismo criterio siempre) para que la
 *  rotación no salte al azar entre cargas. */
export function pickForDate<T>(items: T[], dateKey: string): T {
  const [y, m, d] = dateKey.split("-").map(Number);
  const daysSinceEpoch = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return items[daysSinceEpoch % items.length];
}

export async function getTodayPick(tz?: string | null) {
  const dossiers = await prisma.dossier.findMany({
    where: { status: "published", locale: "es" },
    include: { album: { include: { artist: true } } },
    orderBy: { id: "asc" },
  });
  if (dossiers.length === 0) return null;

  return pickForDate(dossiers, todayKey(tz));
}
