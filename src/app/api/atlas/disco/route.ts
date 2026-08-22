// Fabrica el dossier de un disco del retrato (Fase 11). Mismo trato que un paso
// de un Camino o un disco del Salón: el pipeline tarda 1-3 minutos.

import { NextResponse } from "next/server";
import { abrirDiscoDelAtlas } from "@/lib/atlas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      code?: string;
      orden?: number;
    };
    const code = (body?.code ?? "").trim().toUpperCase();
    const orden = Number(body?.orden);
    if (!code || !Number.isFinite(orden)) {
      return NextResponse.json({ ok: false, reason: "no-encontrado" });
    }
    return NextResponse.json(await abrirDiscoDelAtlas(code, orden));
  } catch (err) {
    console.error("[api/atlas/disco] error:", err);
    return NextResponse.json({ ok: false, reason: "error" });
  }
}
