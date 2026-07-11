// Búsqueda de álbumes con portada para el buscador del curador (panel /revision).
// Proxy a Deezer desde el servidor (evita CORS). Solo para el admin, pero la
// ruta no expone datos sensibles: es la misma búsqueda pública de Deezer.

import { NextResponse } from "next/server";
import { searchAlbums } from "@/lib/sources/deezer";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchAlbums(q);
  return NextResponse.json(
    { results },
    // Cacheable: las portadas no cambian. Alivia búsquedas repetidas.
    { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } },
  );
}
