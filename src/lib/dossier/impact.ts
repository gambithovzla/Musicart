// Recalcula SOLO el impacto cultural (número + nota) de un disco ya generado,
// sobre su FactsPayload guardado. Sirve para arreglar en lote los discos viejos
// que quedaron pegados en 72 (la IA copiaba el ejemplo). Misma rúbrica honesta.

import { llm, extractJson } from "./llm";
import type { FactsPayload } from "../types";

const RUBRICA = `impact (1-100): IMPACTO CULTURAL HONESTO — cuánto movió este disco la historia de la música. Sé REALISTA y conservador: la inmensa mayoría de los discos NO son hitos. No infles. Calíbralo con la evidencia del FACTS PAYLOAD (premios, certificaciones/ventas, presencia en listas históricas, influencia documentada). Si el payload trae poca evidencia, baja la nota.
  · 90-100: hito que cambió la música.
  · 75-89: clásico mayor, muy influyente más allá de su nicho.
  · 60-74: disco importante y respetado en su género o país, con legado real.
  · 40-59: notable, querido o exitoso, pero de impacto histórico modesto.
  · 20-39: sólido, con repercusión local o de nicho.
  · 1-19: impacto cultural mínimo o sin evidencia.
Elige primero el tramo y luego un número concreto dentro; varía según el disco (NO 72 por defecto). Si dudas entre dos tramos, baja al menor.`;

export async function recomputeImpact(
  payload: FactsPayload,
): Promise<{ impact: number; impactNote: string }> {
  const system = `Eres un evaluador musical riguroso. Asignas el IMPACTO CULTURAL de un álbum SOLO con la evidencia del FACTS PAYLOAD. Responde SOLO un JSON: {"impact": <entero 1-100>, "impactNote": "2-3 frases citando la evidencia real (premios, certificaciones, listas, influencia); si no hay evidencia fuerte, dilo con honestidad. PROHIBIDO inventar premios, cifras o rankings."}.

${RUBRICA}`;

  const user = `FACTS PAYLOAD:\n${JSON.stringify(payload, null, 2)}\n\nResponde el JSON ahora.`;

  const raw = await llm({ system, user, temperature: 0.3, maxTokens: 400 });
  const parsed = extractJson<{ impact?: number | string; impactNote?: string }>(raw);

  const n = typeof parsed.impact === "number" ? parsed.impact : Number(parsed.impact);
  const impact = Number.isFinite(n) ? Math.min(100, Math.max(1, Math.round(n))) : 50;
  const impactNote = (parsed.impactNote ?? "").toString().trim().slice(0, 600);

  return { impact, impactNote };
}
