// La madriguera interactiva (Fase 6): al tocar un salto cuyo disco aún no existe,
// se fabrica al momento (pipeline anti-alucinación) y el oyente sigue la cadena.
// Respeta el tope de gasto: si no queda presupuesto, lo deja en la cola.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { todayKey } from "@/lib/daily";
import { TZ_COOKIE } from "@/lib/device";
import { runDossierPipeline } from "@/lib/dossier/pipeline";
import { hayPresupuestoHoy, registrarGeneracion } from "@/lib/budget";
import { enqueueAlbum } from "@/lib/curator";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      artist?: string;
    };
    const title = body.title?.trim();
    const artist = body.artist?.trim();
    if (!title || !artist) {
      return NextResponse.json({ ok: false, reason: "datos" }, { status: 400 });
    }

    const jar = await cookies();
    const tzRaw = jar.get(TZ_COOKIE)?.value;
    const tz = tzRaw ? decodeURIComponent(tzRaw) : null;
    const date = todayKey(tz);

    // Tope de gasto: si no queda, lo dejamos en la cola para más tarde.
    if (!(await hayPresupuestoHoy(date, "extra"))) {
      await enqueueAlbum({
        title,
        artist,
        source: "jump",
        priority: 30,
        reason: "Salto pedido por un oyente (sin presupuesto hoy)",
      }).catch(() => {});
      return NextResponse.json({ ok: false, reason: "sin-presupuesto" });
    }

    const result = await runDossierPipeline(title, artist, { publish: true });
    // Solo consume presupuesto una fabricación real; reutilizar es gratis.
    if (!result.reused) await registrarGeneracion(date);

    if (result.status !== "published") {
      return NextResponse.json({ ok: false, reason: "no-verificado" });
    }
    return NextResponse.json({ ok: true, albumId: result.albumId });
  } catch (err) {
    console.error("[api/saltar] error fabricando el salto:", err);
    return NextResponse.json({ ok: false, reason: "error" });
  }
}
