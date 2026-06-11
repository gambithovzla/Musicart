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

function payloadCorpus(payload: FactsPayload): string {
  return JSON.stringify(payload).toLowerCase();
}

// El verificador LLM suele marcar opiniones como unsupported. Solo conservamos
// claims con anclas factuales concretas (años, cifras) ausentes del payload.
function filterFalsePositives(
  claims: string[],
  payload: FactsPayload,
): string[] {
  const corpus = payloadCorpus(payload);
  return claims.filter((claim) => {
    const years = claim.match(/\b(19|20)\d{2}\b/g) ?? [];
    if (years.some((y) => !corpus.includes(y))) return true;

    const numbers = claim.match(/\b\d+\b/g) ?? [];
    if (numbers.some((n) => !corpus.includes(n))) return true;

    const quantified =
      claim.match(/\b(diez|once|doce|quince|veinte|treinta|cien|mil)\b/gi) ?? [];
    const hasMeasurement =
      /\b(horas?|minutos?|d[ií]as|semanas|meses|copias|ventas|oyentes|escuchas)\b/i.test(
        claim,
      );
    if (
      hasMeasurement &&
      quantified.some((w) => !corpus.includes(w.toLowerCase()))
    ) {
      return true;
    }

    return false;
  });
}

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
  // whyItMatters es 100% editorial — no se validan años ni hechos ahí.
  const narrative = [
    dossier.intro,
    dossier.artistStory,
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
const VERIFIER_SYSTEM = `Eres un verificador de hechos preciso. Recibes un FACTS PAYLOAD (la única fuente de verdad) y un TEXTO generado.

Tu tarea: encontrar SOLO afirmaciones ESTRICTAMENTE FACTUALES del texto que NO estén respaldadas por el payload.

SIEMPRE RESPALDADO — no marques como unsupported:
- Mencionar el título del álbum, el nombre del artista o el año de lanzamiento tal como aparecen en payload.album
- Parafrasear hechos de payload.facts o payload.passages (incluye contexto de Wikipedia)
- Describir el estilo, sonido, atmósfera o significado artístico de canciones o del álbum
- Valoraciones editoriales, impacto cultural en términos generales, invitaciones a escuchar

FACTUAL — verifica SOLO estas, y márcalas unsupported si no están en el payload:
- Fechas, años o décadas distintas a payload.album.year
- Premios y galardones con nombre propio
- Cifras exactas (charts, ventas, duración) no presentes en el payload
- Nombres propios de personas, lugares o sellos no mencionados en el payload
- Eventos concretos narrados como hechos (ej. "grabado en Abbey Road", "rompió con su pareja")

NO FACTUAL — ignóralas siempre:
- Opiniones estéticas y descripciones subjetivas de tracks
- "Pilar del jazz", "cambió la música", "obra definitiva", "punto crucial de su carrera"
- Caracterizaciones de género usadas como descripción ("enfoque modal", "hard rock")
- Interpretaciones emocionales y preguntas

Una afirmación está respaldada si aparece en facts, passages, album o tracklist (puede estar parafraseada o en otro idioma). Ante la duda, NO la marques.

Responde SOLO con JSON: { "unsupported": ["afirmación textual 1", "..."] }
Si todo está respaldado: { "unsupported": [] }`;

export async function llmVerify(
  dossier: GeneratedDossier,
  payload: FactsPayload,
): Promise<string[]> {
  // whyItMatters es 100% editorial — fuera del alcance del verificador.
  const text = [
    `INTRO: ${dossier.intro}`,
    `ARTISTA: ${dossier.artistStory}`,
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
  const rawClaims = await llmVerify(dossier, payload);
  const unsupportedClaims = filterFalsePositives(rawClaims, payload);
  return {
    ok: hardErrors.length === 0 && unsupportedClaims.length === 0,
    hardErrors,
    unsupportedClaims,
  };
}
