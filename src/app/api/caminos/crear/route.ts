// Arma un camino nuevo (Fase 8). Es UNA llamada al LLM, pero con el modelo
// premium puede pasar de los segundos que aguanta una server action, así que
// vive en su propia route con maxDuration holgado.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { getListenerIdentity } from "@/lib/identity";
import { crearCamino } from "@/lib/caminos";

export const dynamic = "force-dynamic";
// 300 y no 120: la propuesta espera hasta 75 s y puede reintentar una vez
// (8.7). Con 120 el reintento se quedaba sin sitio y Vercel cortaba la
// respuesta a medias, que para el oyente es peor que el error original.
export const maxDuration = 300;

/**
 * El detalle técnico del fallo solo viaja al curador. Al oyente no le sirve de
 * nada leer "OpenAI 429", pero al dueño le ahorra adivinar por qué su camino de
 * salsa no salió: sin esto, un fallo en producción es invisible desde el
 * teléfono.
 */
async function esCurador(): Promise<boolean> {
  try {
    const session = await auth();
    return isAdminEmail(session?.user?.email);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { tema?: string };
    const tema = (body?.tema ?? "").trim();
    if (!tema) return NextResponse.json({ ok: false, reason: "sin-tema" });

    const identity = await getListenerIdentity();
    const result = await crearCamino(identity, tema);

    if (!result.ok && result.detalle && !(await esCurador())) {
      return NextResponse.json({ ok: false, reason: result.reason });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/caminos/crear] error:", err);
    return NextResponse.json({
      ok: false,
      reason: "error",
      ...((await esCurador()) ? { detalle: (err as Error)?.message?.slice(0, 300) } : {}),
    });
  }
}
