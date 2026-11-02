// Reescribir historias con el redactor nuevo, desde el teléfono (solo curador).
//
//   POST { albumId }      → reescribe la historia de ese disco (botón del dossier)
//   POST { tanda: n }     → reescribe hasta n historias viejas, las más leídas
//                           primero (botón de /revision)
//
// Como el Salón: trabaja con presupuesto de tiempo y dice cuántas faltan, para
// darle otra vez. Nunca empeora una historia: si la nueva no pasa la
// verificación, se queda la anterior (ver reescribir.ts).

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { reescribirHistoria, reescribirTanda } from "@/lib/dossier/reescribir";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PRESUPUESTO_MS = 240_000;

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        mensaje:
          "Esto solo lo puede hacer el curador. Vuelve a entrar con tu cuenta de administrador.",
      },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { albumId?: unknown; tanda?: unknown };
  const log = (msg: string) => console.log(`[historias/reescribir] ${msg}`);

  try {
    if (typeof body.albumId === "string" && body.albumId) {
      const r = await reescribirHistoria(body.albumId, { log, forzar: true });
      revalidatePath(`/album/${body.albumId}`);
      revalidatePath("/");
      return NextResponse.json(r.ok ? { ...r, mensaje: "Historia reescrita." } : { ...r, mensaje: r.motivo });
    }

    const n = Number(body.tanda);
    const { hechas, pendientes } = await reescribirTanda({
      limite: Number.isFinite(n) && n > 0 ? n : 3,
      presupuestoMs: PRESUPUESTO_MS,
      log,
    });
    for (const h of hechas) if (h.ok) revalidatePath(`/album/${h.albumId}`);
    revalidatePath("/revision");
    const bien = hechas.filter((h) => h.ok).length;
    return NextResponse.json({
      ok: true,
      hechas,
      pendientes,
      mensaje:
        hechas.length === 0
          ? pendientes === 0
            ? "No queda ninguna historia vieja: todas están escritas con el redactor nuevo."
            : "No dio tiempo a empezar ninguna; dale otra vez."
          : `Reescritas ${bien} de ${hechas.length}. Faltan ${pendientes}.`,
    });
  } catch (err) {
    console.error("[api/historias/reescribir] error:", err);
    return NextResponse.json({
      ok: false,
      mensaje: "No se pudo reescribir ahora mismo. Inténtalo otra vez en un rato.",
      detalle: (err as Error).message.replace(/<[^>]*>/g, " ").slice(0, 200),
    });
  }
}
