// Escribe el retrato de un país (Fase 11).
//
// Vive en su propia route por lo mismo que la de los Caminos: es una llamada al
// LLM que puede tardar más de lo que aguanta una server action, y encima
// después comprueba el origen de cinco artistas contra tres fuentes.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { retratoDePais } from "@/lib/atlas";

export const dynamic = "force-dynamic";
// 300: la propuesta espera hasta 75 s, puede reintentar, y luego vienen las
// comprobaciones de origen. Con menos, el retrato se corta a medias.
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      code?: string;
      rehacer?: boolean;
    };
    const code = (body?.code ?? "").trim().toUpperCase();
    if (!code) return NextResponse.json({ ok: false, reason: "sin-pais" });

    // Rehacer un retrato que ya está escrito es gastar IA en algo que ya
    // existe: solo el curador.
    let rehacer = false;
    if (body?.rehacer) {
      const session = await auth().catch(() => null);
      rehacer = isAdminEmail(session?.user?.email);
    }

    const retrato = await retratoDePais(code, { rehacer });
    if (!retrato) return NextResponse.json({ ok: false, reason: "no-encontrado" });

    return NextResponse.json({ ok: true, status: retrato.status });
  } catch (err) {
    console.error("[api/atlas/retrato] error:", err);
    return NextResponse.json({ ok: false, reason: "error" });
  }
}
