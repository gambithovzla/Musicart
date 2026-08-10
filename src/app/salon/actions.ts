"use server";

// Acciones del Salón de la Fama (Fase 9).
// Todo lo de aquí es barato: consultas al índice ya calculado. Ninguna llamada
// a un LLM — el dial tiene que responder al instante o no es un dial.

import { getListenerIdentity } from "@/lib/identity";
import { discoDePuntaje, type DiscoDePuntaje } from "@/lib/canon/consulta";

/** El dial: "dame un disco de 95". Devuelve null si el índice no tiene nada cerca. */
export async function pedirDiscoDePuntaje(
  score: number,
): Promise<DiscoDePuntaje | null> {
  const objetivo = Number(score);
  if (!Number.isFinite(objetivo)) return null;

  const identity = await getListenerIdentity();
  return discoDePuntaje(objetivo, identity);
}
