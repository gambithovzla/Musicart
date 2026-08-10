// Levantar el Salón de la Fama desde el teléfono (9.10).
//
// El índice del canon se construía SOLO con `npm run canon`, o sea con una
// terminal delante. Mientras nadie lo corriera, la pestaña `/salon` se veía
// vacía ("El Salón se está levantando") y no había forma de arreglarlo desde la
// app. Esto es esa forma: el dueño le da a un botón y el índice avanza un tramo.
//
// Va a trozos a propósito: la ingesta entera tarda más de lo que aguanta una
// función de Vercel, así que cada llamada trabaja con un presupuesto de tiempo,
// deja el índice coherente (siempre recalibra) y dice si hay que volver a darle.
// De noche, el worker de Railway hace lo mismo sin límite y sin que nadie mire.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { avanzarSalon } from "@/lib/canon/ingest";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Nos guardamos un margen contra el techo de la función: preferimos terminar
// bien y decir "dale otra vez" a que nos corten a mitad de una escritura.
const PRESUPUESTO_MS = 240_000;

export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ ok: false, mensaje: "Solo el curador." }, { status: 403 });
  }

  try {
    const avance = await avanzarSalon({
      presupuestoMs: PRESUPUESTO_MS,
      // Sin Last.fm: son mil peticiones más y aquí corre el reloj. Los oyentes y
      // los géneros los añade el worker de noche, que no tiene prisa.
      conOyentes: false,
      log: (msg) => console.log(`[salon/construir] ${msg}`),
    });

    revalidatePath("/salon");
    revalidatePath("/salon/lista");
    revalidatePath("/revision");

    return NextResponse.json({ ok: true, ...avance });
  } catch (err) {
    console.error("[api/salon/construir] error:", err);
    return NextResponse.json({
      ok: false,
      mensaje:
        "No se pudo avanzar el Salón ahora mismo. Suele ser Wikidata sin " +
        "responder: inténtalo otra vez en un rato.",
      detalle: (err as Error).message?.slice(0, 300),
    });
  }
}
