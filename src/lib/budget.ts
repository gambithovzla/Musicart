// Tope de gasto de IA (Fase 6). El costo real de Musicart es fabricar discos
// NUEVOS (investigar + escribir + verificar con el LLM). Este módulo limita
// cuántos se fabrican al día para los oyentes: al llegar al tope, el pick del
// día cae al catálogo existente (sin costo de IA nueva). Así puedes abrir la app
// a testers sin sustos. No afecta lo que generas como admin ni el worker.

import { prisma } from "./db";

const DEFAULT_BUDGET = 15;

/** Máximo de discos nuevos por día para oyentes (env DAILY_GENERATION_BUDGET). */
export function dailyGenerationBudget(): number {
  const n = Number(process.env.DAILY_GENERATION_BUDGET ?? DEFAULT_BUDGET);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_BUDGET;
}

/** Cuántos discos nuevos se fabricaron hoy (para oyentes). */
export async function generacionesHoy(date: string): Promise<number> {
  const row = await prisma.generationBudget.findUnique({ where: { date } });
  return row?.count ?? 0;
}

/** ¿Queda presupuesto para fabricar un disco nuevo hoy? */
export async function hayPresupuestoHoy(date: string): Promise<boolean> {
  return (await generacionesHoy(date)) < dailyGenerationBudget();
}

/** Registra que se fabricó un disco nuevo hoy (incremento atómico). */
export async function registrarGeneracion(date: string): Promise<void> {
  await prisma.generationBudget.upsert({
    where: { date },
    create: { date, count: 1 },
    update: { count: { increment: 1 } },
  });
}
