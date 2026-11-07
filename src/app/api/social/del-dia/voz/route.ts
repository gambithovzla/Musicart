// La voz de una pieza del día, para la imprenta de la laptop. El almacén de Blob
// es privado, así que el MP3 no se puede bajar con su URL: se reenvía desde aquí
// a quien traiga la llave (SOCIAL_API_KEY).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { llaveValida } from "@/lib/social/llave";
import { leerMedio } from "@/lib/social/storage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!llaveValida(req)) return NextResponse.json({ error: "Llave incorrecta." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id de la pieza." }, { status: 400 });
  const pieza = await prisma.socialContent.findUnique({ where: { id }, select: { audioUrl: true } });
  if (!pieza?.audioUrl) return NextResponse.json({ error: "Esa pieza aún no tiene voz." }, { status: 404 });
  const medio = await leerMedio(pieza.audioUrl);
  if (!medio) return NextResponse.json({ error: "No pude leer la voz guardada." }, { status: 502 });
  return new Response(medio.stream, {
    headers: { "Content-Type": medio.contentType, "Cache-Control": "no-store" },
  });
}
