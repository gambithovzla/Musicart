// Verificación en dos capas:
// 1. Validadores duros en código (años, títulos de tracks) — deterministas.
// 2. Verificador LLM: contrasta cada afirmación factual contra el payload.

import { llm, extractJson } from "./llm";
import type { FactsPayload } from "../types";
import type { GeneratedDossier } from "./generate";

export type VerificationReport = {
  ok: boolean;
  hardErrors: string[];
  unsupportedClaims: string[];
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

// — Capa 1: validadores deterministas —
export function hardValidate(
  dossier: GeneratedDossier,
  payload: FactsPayload,
): string[] {
  const errors: string[] = [];
  const payloadText = JSON.stringify(payload);
  const narrative = [
    dossier.intro,
    dossier.artistStory,
    dossier.whyItMatters,
    ...dossier.trackNotes.map((t) => t.note ?? ""),
  ].join("\n");

  // Todo año citado debe existir en el payload.
  for (const year of narrative.match(/\b(19|20)\d{2}\b/g) ?? []) {
    if (!payloadText.includes(year)) {
      errors.push(`El año ${year} no aparece en el facts payload.`);
    }
  }

  // Cada track note debe corresponder a un track real (título normalizado).
  const tracks = new Map(payload.tracklist.map((t) => [normalize(t.title), t]));
  for (const note of dossier.trackNotes) {
    const match =
      tracks.get(normalize(note.title)) ??
      [...tracks.values()].find(
        (t) =>
          normalize(t.title).includes(normalize(note.title)) ||
          normalize(note.title).includes(normalize(t.title)),
      );
    if (!match) {
      errors.push(`Track note sobre "${note.title}": no existe en el tracklist.`);
    } else {
      // Corrige posición y título al canónico.
      note.position = match.position;
      note.title = match.title;
    }
  }

  return errors;
}

// — Capa 2: verificador LLM —
const VERIFIER_SYSTEM = `Eres un verificador de hechos implacable. Recibes un FACTS PAYLOAD (la única fuente de verdad) y un TEXTO generado.

Tu tarea: encontrar afirmaciones FACTUALES del texto que NO estén respaldadas por el payload.
- Factual = fechas, premios, cifras, nombres propios, eventos, anécdotas, relaciones entre personas.
- NO factual (ignóralas): opiniones estéticas, descripciones de sonido, invitaciones a escuchar, preguntas, interpretaciones emocionales.
- Una afirmación está respaldada si el payload la contiene o la implica directamente (puede estar parafraseada o en otro idioma).

Responde SOLO con JSON: { "unsupported": ["afirmación textual 1", "..."] }
Si todo está respaldado: { "unsupported": [] }`;

export async function llmVerify(
  dossier: GeneratedDossier,
  payload: FactsPayload,
): Promise<string[]> {
  const text = [
    `INTRO: ${dossier.intro}`,
    `ARTISTA: ${dossier.artistStory}`,
    `POR QUÉ IMPORTA: ${dossier.whyItMatters}`,
    ...dossier.trackNotes.map((t) => `NOTA (${t.title}): ${t.note}`),
    // De los saltos solo se verifica la conexión afirmada (el álbum destino
    // es recomendación curatorial, no una afirmación factual).
    ...(dossier.jumps ?? []).map((j) => `SALTO HACIA ${j.artist}: ${j.connection}`),
  ].join("\n\n");

  const raw = await llm({
    system: VERIFIER_SYSTEM,
    user: `FACTS PAYLOAD:\n${JSON.stringify(payload, null, 2)}\n\nTEXTO A VERIFICAR:\n${text}`,
    temperature: 0,
  });
  return extractJson<{ unsupported: string[] }>(raw).unsupported ?? [];
}

export async function verifyDossier(
  dossier: GeneratedDossier,
  payload: FactsPayload,
): Promise<VerificationReport> {
  const hardErrors = hardValidate(dossier, payload);
  const unsupportedClaims = await llmVerify(dossier, payload);
  return {
    ok: hardErrors.length === 0 && unsupportedClaims.length === 0,
    hardErrors,
    unsupportedClaims,
  };
}
