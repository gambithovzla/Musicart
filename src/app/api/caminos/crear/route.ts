// Arma un camino nuevo (Fase 8). Es UNA llamada al LLM, pero con el modelo
// premium puede pasar de los segundos que aguanta una server action, así que
// vive en su propia route con maxDuration holgado.

import { NextResponse } from "next/server";
import { getListenerIdentity } from "@/lib/identity";
import { crearCamino } from "@/lib/caminos";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { tema?: string };
    const tema = (body?.tema ?? "").trim();
    if (!tema) return NextResponse.json({ ok: false, reason: "sin-tema" });

    const identity = await getListenerIdentity();
    const result = await crearCamino(identity, tema);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/caminos/crear] error:", err);
    return NextResponse.json({ ok: false, reason: "error" });
  }
}
