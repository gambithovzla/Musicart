// Autocompletado de artistas (con foto) para el onboarding del perfil.
// Proxy a Deezer desde el servidor: evita problemas de CORS y deja la API
// pública detrás de nuestra propia ruta.

import { NextResponse } from "next/server";
import { searchArtists } from "@/lib/sources/deezer";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchArtists(q);
  return NextResponse.json(
    { results },
    // Cacheable: las fotos de artistas no cambian. Alivia llamadas repetidas.
    { headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } },
  );
}
