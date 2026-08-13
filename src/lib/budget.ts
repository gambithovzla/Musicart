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

/**
 * Para qué se pide el cupo. No todo lo que gasta IA vale lo mismo:
 *   · "ritual" → el disco del día, que es la app.
 *   · "extra"  → abrir un disco del Salón, un paso de un Camino, un salto de la
 *                madriguera. Son puertas laterales, y son las que más fácil se
 *                pulsan seguidas.
 * Antes compartían un solo contador y el que llegaba primero se lo comía todo:
 * una tarde curioseando el Salón dejaba sin cupo al disco del día siguiente, que
 * entonces caía al catálogo, repetía disco y se saltaba el pedido — sin decirlo.
 */
export type UsoPresupuesto = "ritual" | "extra";

/** Parte del tope que queda RESERVADA para el disco del día (el resto es libre). */
const RESERVA_RITUAL = 0.3;

/** ¿Queda presupuesto para fabricar un disco nuevo hoy? */
export async function hayPresupuestoHoy(
  date: string,
  uso: UsoPresupuesto = "ritual",
): Promise<boolean> {
  const tope = dailyGenerationBudget();
  const techo =
    uso === "extra" ? Math.max(1, Math.floor(tope * (1 - RESERVA_RITUAL))) : tope;
  return (await generacionesHoy(date)) < techo;
}

/** Cuánto queda hoy para cada uso (para contarlo en el panel del dueño). */
export async function estadoPresupuesto(date: string): Promise<{
  usados: number;
  tope: number;
  quedanRitual: number;
  quedanExtra: number;
}> {
  const [usados, tope] = [await generacionesHoy(date), dailyGenerationBudget()];
  const techoExtra = Math.max(1, Math.floor(tope * (1 - RESERVA_RITUAL)));
  return {
    usados,
    tope,
    quedanRitual: Math.max(0, tope - usados),
    quedanExtra: Math.max(0, techoExtra - usados),
  };
}

/** Registra que se fabricó un disco nuevo hoy (incremento atómico). */
export async function registrarGeneracion(date: string): Promise<void> {
  await prisma.generationBudget.upsert({
    where: { date },
    create: { date, count: 1 },
    update: { count: { increment: 1 } },
  });
}
