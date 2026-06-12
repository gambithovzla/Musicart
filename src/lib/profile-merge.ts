// Fusión de respuestas de perfil entre dispositivo y cuenta (sin dependencias circulares).

import { parseJson } from "./types";

export function profileHasSignal(answersJson: string): boolean {
  const a = parseJson<Record<string, unknown>>(answersJson, {});
  const genres = Array.isArray(a.genres) ? a.genres : [];
  const artists = Array.isArray(a.artists) ? a.artists : [];
  const languages = Array.isArray(a.languages) ? a.languages : [];
  return (
    genres.length > 0 ||
    artists.length > 0 ||
    languages.length > 0 ||
    Boolean(String(a.markedAlbum ?? "").trim()) ||
    Boolean(String(a.bio ?? "").trim())
  );
}

export function profileRichness(answersJson: string): number {
  const a = parseJson<Record<string, unknown>>(answersJson, {});
  let score = 0;
  for (const key of ["genres", "artists", "languages", "moments", "seeks", "interests"]) {
    if (Array.isArray(a[key])) score += (a[key] as unknown[]).length;
  }
  if (String(a.listenTime ?? "").trim()) score += 2;
  if (String(a.markedAlbum ?? "").trim()) score += 2;
  if (String(a.bio ?? "").trim()) score += 2;
  return score;
}

/** Fusiona respuestas: conserva lo no vacío de ambos lados. */
export function mergeProfileAnswers(
  account: Record<string, unknown>,
  device: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...account };
  for (const [key, val] of Object.entries(device)) {
    if (Array.isArray(val) && val.length > 0) {
      const prev = Array.isArray(out[key]) ? (out[key] as unknown[]) : [];
      out[key] = [...new Set([...prev, ...val])];
    } else if (typeof val === "string" && val.trim() && !String(out[key] ?? "").trim()) {
      out[key] = val;
    } else if (
      val &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      Object.keys(val as object).length > 0
    ) {
      out[key] = { ...(out[key] as object), ...(val as object) };
    }
  }
  return out;
}
