// Convierte la paleta extraída de la portada en variables CSS:
// toda la página se tiñe con los colores del disco del día.

import type { CSSProperties } from "react";
import type { Palette } from "./types";
import { DEFAULT_PALETTE } from "./palette";

export function albumThemeStyle(palette: Palette | null): CSSProperties {
  const p = { ...DEFAULT_PALETTE, ...(palette ?? {}) };
  return {
    "--album-vibrant": p.vibrant,
    "--album-dark": p.darkVibrant,
    "--album-light": p.lightVibrant,
    "--album-muted": p.muted,
    "--album-dark-muted": p.darkMuted,
  } as CSSProperties;
}
