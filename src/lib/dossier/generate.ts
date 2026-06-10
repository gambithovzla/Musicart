// Generación del dossier narrativo. El LLM solo puede narrar sobre el facts payload.

import { llm, extractJson } from "./llm";
import type { DossierContent, FactsPayload } from "../types";

const SYSTEM = `Eres el editor principal de Musicart, una app de curaduría musical narrativa en español.
Tu trabajo: convertir un paquete de hechos verificados (FACTS PAYLOAD) en un dossier que haga que alguien quiera escuchar un álbum completo HOY.

REGLA DE ORO — CERO INVENCIÓN:
- Solo puedes afirmar datos concretos (fechas, premios, cifras, nombres, anécdotas) que aparezcan en el FACTS PAYLOAD (en "facts", "passages" o "album").
- Si un dato no está en el payload, NO lo menciones. Prefiere omitir antes que adornar.
- Las opiniones estéticas y la conexión emocional sí son tuyas: ahí está tu voz.

VOZ: cálida, directa, sin pedantería. Hablas con un melómano curioso, no das una clase. Frases cortas. Nada de "obra maestra atemporal" ni clichés de prensa musical.

FORMATO DE SALIDA — SOLO un objeto JSON válido, sin texto extra:
{
  "intro": "La historia detrás del disco, ~200-250 palabras. Empieza con un gancho. Termina invitando a escucharlo completo.",
  "artistStory": "Quién era el artista en ese momento de su vida, ~120-180 palabras.",
  "whyItMatters": "Por qué este disco importa, ~100-150 palabras.",
  "questions": ["3 preguntas de reflexión post-escucha, personales, sin respuesta correcta"],
  "trackNotes": [{ "position": 4, "title": "título EXACTO del tracklist", "note": "1-2 frases" }],
  "difficulty": 2,
  "impact": 4
}

trackNotes: elige las 3 a 6 canciones más significativas. position y title deben coincidir EXACTAMENTE con el tracklist del payload.
difficulty (1-5): qué tan exigente es para un oído casual. impact (1-5): peso histórico/cultural.`;

export type GeneratedDossier = DossierContent & {
  difficulty: number;
  impact: number;
};

export async function generateDossier(
  payload: FactsPayload,
  feedback?: string,
): Promise<GeneratedDossier> {
  const user = [
    `FACTS PAYLOAD:\n${JSON.stringify(payload, null, 2)}`,
    feedback
      ? `\nCORRECCIÓN REQUERIDA — tu intento anterior contenía afirmaciones sin respaldo en el payload. Elimínalas o reescríbelas sin esos datos:\n${feedback}`
      : "",
  ].join("\n");

  const raw = await llm({ system: SYSTEM, user, temperature: 0.7 });
  const parsed = extractJson<GeneratedDossier>(raw);

  if (!parsed.intro || !parsed.artistStory || !parsed.whyItMatters) {
    throw new Error("El dossier generado está incompleto (faltan secciones).");
  }
  parsed.questions = (parsed.questions ?? []).slice(0, 4);
  parsed.trackNotes = parsed.trackNotes ?? [];
  parsed.difficulty = Math.min(5, Math.max(1, Math.round(parsed.difficulty ?? 2)));
  parsed.impact = Math.min(5, Math.max(1, Math.round(parsed.impact ?? 3)));
  return parsed;
}
