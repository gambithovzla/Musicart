// Las dos operaciones caras de un paso del camino (Fase 8):
//   abrir     → fabrica el dossier del disco con el pipeline (1-3 min si es nuevo)
//   reemplazar→ pide otro disco del mismo papel ("ya lo conozco", o el anterior
//               no pasó verificación y dejaría el camino en un callejón)
// Por eso maxDuration alto, igual que /api/pick-hoy.

import { NextResponse } from "next/server";
import { getListenerIdentity } from "@/lib/identity";
import { abrirPaso, reemplazarPaso } from "@/lib/caminos";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      caminoId?: string;
      orden?: number;
      accion?: "abrir" | "reemplazar";
    };
    const caminoId = (body?.caminoId ?? "").trim();
    const orden = Number(body?.orden);
    if (!caminoId || !Number.isFinite(orden)) {
      return NextResponse.json({ ok: false, reason: "datos-incompletos" });
    }

    const identity = await getListenerIdentity();

    if (body?.accion === "reemplazar") {
      const ok = await reemplazarPaso(caminoId, orden, identity);
      return NextResponse.json({ ok, reason: ok ? undefined : "error" });
    }

    const result = await abrirPaso(caminoId, orden, identity);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/caminos/paso] error:", err);
    return NextResponse.json({ ok: false, reason: "error" });
  }
}
