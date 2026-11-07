// La pieza del día para Panteón (Fase 12.7). Ver src/lib/social/del-dia.ts.
//
//   GET  → en qué punto está la pieza de hoy (no gasta nada).
//   POST { accion: "avanzar", aprobar?, rehacer?, pedido? | disco?+artista? } → da los pasos que quepan en
//        el reloj de la ruta. Se llama hasta que el estado sea
//        "lista-para-imprimir" (o "bloqueada": ese día no hay video).
//   POST { accion: "imprimiendo" | "impreso" | "fallo", id, videoUrl?, error? }
//        → la imprenta de la laptop avisa de cómo le fue.
//
// Siempre con `Authorization: Bearer <SOCIAL_API_KEY>`. Nunca responde 500 por
// la IA: si algo falla, la respuesta lo cuenta en `bitacora` y en `siguiente`.

import { NextResponse } from "next/server";
import { z } from "zod";
import { llaveConfigurada, llaveValida } from "@/lib/social/llave";
import {
  avanzarPiezaDelDia,
  consultarPiezaDelDia,
  marcarImpresion,
} from "@/lib/social/del-dia";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const cuerpo = z.discriminatedUnion("accion", [
  z.object({
    accion: z.literal("avanzar"),
    aprobar: z.boolean().optional(),
    rehacer: z.boolean().optional(),
    // Un artista o un pedido libre («Wolf Alice», «rock venezolano»), o un disco exacto.
    // Solo en la PRIMERA llamada: empieza una pieza nueva con eso.
    pedido: z.string().trim().max(300).optional(),
    disco: z.string().trim().max(200).optional(),
    artista: z.string().trim().max(200).optional(),
  }),
  z.object({
    accion: z.enum(["imprimiendo", "impreso", "fallo"]),
    id: z.string().min(1),
    videoUrl: z.string().url().nullish(),
    error: z.string().max(2000).nullish(),
  }),
]);

function cerrado() {
  return llaveConfigurada()
    ? NextResponse.json({ error: "Llave incorrecta." }, { status: 401 })
    : NextResponse.json(
        { error: "Falta configurar SOCIAL_API_KEY en Vercel: la puerta de Panteón está cerrada." },
        { status: 503 },
      );
}

export async function GET(req: Request) {
  if (!llaveValida(req)) return cerrado();
  return NextResponse.json(await consultarPiezaDelDia(new URL(req.url).origin));
}

export async function POST(req: Request) {
  if (!llaveValida(req)) return cerrado();
  const parsed = cuerpo.safeParse(await req.json().catch(() => ({ accion: "avanzar" })));
  if (!parsed.success) {
    return NextResponse.json({ error: "Cuerpo inválido.", detalle: parsed.error.issues }, { status: 400 });
  }
  const origen = new URL(req.url).origin;
  const b = parsed.data;
  try {
    if (b.accion === "avanzar") {
      return NextResponse.json(
        // 300 s de ruta menos un colchón para responder.
        await avanzarPiezaDelDia({
          presupuestoMs: 270_000,
          aprobar: b.aprobar,
          rehacer: b.rehacer,
          pedido: b.pedido || (b.disco && b.artista) ? { texto: b.pedido, disco: b.disco, artista: b.artista } : null,
          origen,
        }),
      );
    }
    return NextResponse.json(
      await marcarImpresion({ id: b.id, estado: b.accion, videoUrl: b.videoUrl, error: b.error }),
    );
  } catch (err) {
    // Lo que llegue aquí es un fallo de datos, no de la IA (esa ya se maneja
    // dentro): se cuenta tal cual para que el agente se lo diga al dueño.
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
}
