// Fabricar el dossier de un disco del Salón de la Fama (Fase 9).
// Tarda 1-3 minutos si el disco es nuevo, así que va en su propia route con
// maxDuration alto, como /api/pick-hoy y /api/caminos/paso.

import { NextResponse } from "next/server";
import { abrirDiscoDelCanon } from "@/lib/canon/abrir";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { canonId?: string };
    const canonId = (body?.canonId ?? "").trim();
    if (!canonId) {
      return NextResponse.json({ ok: false, reason: "datos-incompletos" });
    }

    return NextResponse.json(await abrirDiscoDelCanon(canonId));
  } catch (err) {
    console.error("[api/salon/abrir] error:", err);
    return NextResponse.json({ ok: false, reason: "error" });
  }
}
