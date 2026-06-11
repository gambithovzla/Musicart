// Rotación determinista global sobre los dossiers publicados.
// Desde la Fase 1 es el fallback del pick personalizado (src/lib/recommend.ts):
// usuarios sin señales, o cualquier fallo de la IA, caen aquí. Nunca se rompe.

import { prisma } from "./db";

export function todayKey(tz?: string | null): string {
  const now = new Date();
  if (tz) {
    try {
      // en-CA produce el formato YYYY-MM-DD que necesitamos
      return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
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

export async function getTodayPick(tz?: string | null) {
  const dossiers = await prisma.dossier.findMany({
    where: { status: "published", locale: "es" },
    include: { album: { include: { artist: true } } },
    orderBy: { id: "asc" },
  });
  if (dossiers.length === 0) return null;

  const key = todayKey(tz);
  const [y, m, d] = key.split("-").map(Number);
  const daysSinceEpoch = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  return dossiers[daysSinceEpoch % dossiers.length];
}
