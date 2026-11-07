// La llave de Panteón: las rutas de /api/social/* que usa un agente de fuera
// (Efesto, en la laptop) se abren solo con `Authorization: Bearer <SOCIAL_API_KEY>`.
// Sin la variable configurada, la puerta está cerrada para todos.

import { timingSafeEqual } from "node:crypto";

export function llaveConfigurada(): boolean {
  return Boolean(process.env.SOCIAL_API_KEY?.trim());
}

export function llaveValida(req: Request): boolean {
  const esperada = process.env.SOCIAL_API_KEY?.trim();
  if (!esperada) return false;
  const cabecera = req.headers.get("authorization") ?? "";
  const dada = cabecera.replace(/^Bearer\s+/i, "").trim();
  const a = Buffer.from(dada);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}
