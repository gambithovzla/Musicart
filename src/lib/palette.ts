// Extracción de paleta de colores desde la portada (server-side, node-vibrant).
// La paleta tiñe toda la UI del día — se calcula una vez y se guarda en DB.

import { Vibrant } from "node-vibrant/node";
import type { Palette } from "./types";

export const DEFAULT_PALETTE: Palette = {
  vibrant: "#c8a24a",
  darkVibrant: "#7a5c1e",
  lightVibrant: "#e8cf8e",
  muted: "#8a7a55",
  darkMuted: "#2a2419",
  lightMuted: "#cfc4a5",
};

export async function extractPalette(coverUrl: string): Promise<Palette | null> {
  try {
    const res = await fetch(coverUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const palette = await Vibrant.from(buffer).getPalette();
    return {
      vibrant: palette.Vibrant?.hex,
      darkVibrant: palette.DarkVibrant?.hex,
      lightVibrant: palette.LightVibrant?.hex,
      muted: palette.Muted?.hex,
      darkMuted: palette.DarkMuted?.hex,
      lightMuted: palette.LightMuted?.hex,
    };
  } catch {
    return null;
  }
}
