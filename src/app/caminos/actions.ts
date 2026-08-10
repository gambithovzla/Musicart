"use server";

// Acciones cortas del camino (las largas —armar el camino y fabricar el disco de
// un paso— viven en /api/caminos/* con maxDuration alto, porque llaman al LLM).

import { revalidatePath } from "next/cache";
import { getListenerIdentity } from "@/lib/identity";
import { marcarEscuchado, borrarCamino } from "@/lib/caminos";

export async function marcarPasoEscuchado(caminoId: string, orden: number) {
  const identity = await getListenerIdentity();
  const ok = await marcarEscuchado(caminoId, orden, identity);
  if (ok) {
    revalidatePath(`/caminos/${caminoId}`);
    revalidatePath("/caminos");
    revalidatePath("/");
  }
  return ok;
}

export async function eliminarCamino(caminoId: string) {
  const identity = await getListenerIdentity();
  const ok = await borrarCamino(caminoId, identity);
  if (ok) {
    revalidatePath("/caminos");
    revalidatePath("/");
  }
  return ok;
}
