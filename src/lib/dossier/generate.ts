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
  "whyItMatters": "Por qué este disco importa, ~100-150 palabras. Esta sección es 100% editorial: tu opinión como curador sobre por qué vale la pena escucharlo hoy. No pongas datos ni fechas aquí.",
  "questions": ["3 preguntas de reflexión post-escucha, personales, sin respuesta correcta"],
  "trackNotes": [{ "position": 4, "title": "título EXACTO del tracklist", "note": "1-2 frases" }],
  "jumps": [{ "title": "álbum destino", "artist": "artista destino", "connection": "1 frase: la relación real que une este disco con aquel" }],
  "difficulty": 2,
  "impact": 72
}

trackNotes: elige las 3 a 6 canciones más significativas. position y title deben coincidir EXACTAMENTE con el tracklist del payload.
jumps: 0 a 3 saltos de descubrimiento ("de aquí puedes saltar a…"): rivalidades, colaboraciones, influencias, mismo productor. La "connection" SOLO puede afirmar relaciones que aparezcan en el FACTS PAYLOAD (menciona la relación, no inventes datos del álbum destino). El álbum destino es tu recomendación curatorial de melómano. Si el payload no respalda ninguna conexión, devuelve [].

difficulty (1-5): qué tan exigente es para un oído casual (1 = se entra fácil, 5 = pide oído atento).

impact (1-100): IMPACTO CULTURAL HONESTO — cuánto movió este disco la historia de la música. Sé REALISTA y conservador: la inmensa mayoría de los discos NO son hitos. No infles. Calíbralo con la evidencia del FACTS PAYLOAD (premios, certificaciones/ventas, presencia en listas históricas, influencia documentada, reinvención de un género). Si el payload trae poca evidencia de impacto, baja la nota; no premies un disco solo por ser querido o exitoso comercialmente.
  · 90-100: hito que cambió la música (referente ineludible, redefinió un género o una época).
  · 75-89: clásico mayor, muy influyente y aclamado más allá de su nicho.
  · 60-74: disco importante y respetado en su género o país, con legado real.
  · 40-59: disco notable, querido o exitoso, pero de impacto histórico modesto.
  · 20-39: sólido, con repercusión local o de nicho.
  · 1-19: impacto cultural mínimo o sin evidencia.
Dos discos de distinto calibre NO deben quedar con la misma nota: úsala para diferenciar.`;

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
  parsed.jumps = (parsed.jumps ?? [])
    .filter((j) => j?.title && j?.artist && j?.connection)
    .slice(0, 3);
  parsed.difficulty = Math.min(5, Math.max(1, Math.round(parsed.difficulty ?? 2)));
  parsed.impact = Math.min(100, Math.max(1, Math.round(parsed.impact ?? 45)));
  return parsed;
}
