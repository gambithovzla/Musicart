// Rotación determinista global sobre los dossiers publicados.
// Desde la Fase 1 es el fallback del pick personalizado (src/lib/recommend.ts):
// usuarios sin señales, o cualquier fallo de la IA, caen aquí. Nunca se rompe.

import { prisma } from "./db";

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDateEs(date = new Date()): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export async function getTodayPick() {
  const dossiers = await prisma.dossier.findMany({
    where: { status: "published", locale: "es" },
    include: { album: { include: { artist: true } } },
    orderBy: { id: "asc" },
  });
  if (dossiers.length === 0) return null;

  const now = new Date();
  const daysSinceEpoch = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000,
  );
  return dossiers[daysSinceEpoch % dossiers.length];
}
