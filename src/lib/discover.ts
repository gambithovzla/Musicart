// Fase 6 — El disco fresco del día.
// En vez de elegir entre los discos ya publicados, la IA PROPONE un disco real
// de toda la música grabada para que este usuario lo descubra hoy, según su
// gusto, su diario y su ánimo. Luego el pipeline (facts → narra → verifica) lo
// fabrica. Así cada día nace un disco nuevo, personalizado — no uno "sembrado".

import { llm, extractJson } from "./dossier/llm";

const LLM_TIMEOUT_MS = 12_000;

export type DiscoPropuesto = {
  title: string;
  artist: string;
  year: number | null;
  reason: string;
};

/**
 * Pide al LLM UN disco para descubrir hoy. Recibe bloques de texto ya formateados
 * con las señales reales del usuario (perfil, diario, picks recientes) para que
 * la "reason" cite solo lo verdadero y la propuesta encaje con su gusto.
 */
export async function proponerDiscoDescubrimiento(input: {
  perfilTexto: string;
  diarioTexto: string;
  recientesTexto: string; // discos ya mostrados (a evitar)
  yaConoce: string[]; // títulos que ya reseñó o se le mostraron (a evitar)
  mood: string | null;
  lang: string | null;
  esRegreso: boolean;
  diasAusente: number | null;
  /** Rehacer el disco de hoy: debe ser distinto al que acaba de descartar. */
  esRehacer?: boolean;
}): Promise<DiscoPropuesto> {
  const evitarTexto =
    input.yaConoce.length > 0
      ? input.yaConoce.map((t) => `- ${t}`).join("\n")
      : "(ninguno todavía)";

  const regresoTexto = input.esRegreso
    ? `\nREGRESO TRAS AUSENCIA: el usuario vuelve después de ${input.diasAusente ?? "varios"} días sin abrir la app. Elige un disco acogedor para reengancharlo y, en "reason", reconoce el regreso con calidez ("te guardé algo", "bienvenido de vuelta"), SIN culpa ni gamificación.\n`
    : "";

  const rehacerTexto = input.esRehacer
    ? `\nREHACER HOY: el usuario pidió OTRO disco distinto para hoy. PROHIBIDO repetir cualquier disco de las listas "ya conoce" o "días recientes". Elige algo diferente aunque encaje igual de bien con su gusto.\n`
    : "";

  const idiomaRegla = input.lang
    ? `\n8. IDIOMA DE HOY: el usuario quiere música en "${input.lang}" hoy. Prioriza un disco cantado en ese idioma; si no encaja con su gusto, elige lo más cercano y dilo en la "reason".`
    : "";

  const system = `Eres el curador musical de Musicart: cercano, melómano, hablas en español y de "tú".
Tu trabajo HOY: proponer UN disco real para que esta persona lo DESCUBRA, elegido de TODA la música grabada (cualquier época, país, género), no de una lista cerrada.

Reglas estrictas:
1. Responde SOLO un objeto JSON: {"title": "...", "artist": "...", "year": 1979, "reason": "..."} — sin texto extra.
2. Debe ser un disco REAL y bien documentado (que exista en MusicBrainz/Wikipedia), con su título y artista exactos. Nada inventado.
3. Debe ser un ÁLBUM de estudio COMPLETO (varias canciones). PROHIBIDO: sencillos (singles), EPs, recopilatorios o títulos que terminen en "Single", "EP" o "- Single". Si dudas, elige el álbum completo de ese artista, no la canción suelta.
4. DESCUBRIMIENTO: elige algo que probablemente NO conozca pero que encaje con su gusto — un puente desde lo que ama hacia algo nuevo. Mejor un disco que sienta suyo que uno "objetivamente importante" pero ajeno.
5. GUSTO ANTE TODO: respeta sus géneros y artistas favoritos. Un rockero NO recibe una balada romántica salvo como puente claro y justificado en la "reason".
6. NO propongas ninguno de los discos que ya se le mostraron o que ya reseñó (lista abajo). Cada día es un disco distinto.
7. "reason": 1 a 3 frases cálidas y concretas, citando SOLO señales reales del usuario que aparecen abajo (sus estrellas, sus respuestas, su perfil, su ánimo). PROHIBIDO inventar datos del usuario.
   TIENDE UN PUENTE desde su HISTORIA RECIENTE: si en su diario hay un disco que amó (puntaje alto) o un comentario suyo, arranca desde ahí y conéctalo con el de hoy, para que sienta la continuidad de su viaje — no una frase genérica. Ej.: "Como te voló «X» de Y, hoy te llevo a Z, que comparte ese mismo nervio". Usa el nombre real del disco/comentario que aparece en su diario.${idiomaRegla}`;

  const user = `PERFIL DEL USUARIO:
${input.perfilTexto}

SU DIARIO (reseñas recientes, de la más nueva a la más vieja):
${input.diarioTexto}

ÁNIMO DE HOY: ${input.mood ?? "(no indicado)"}
${regresoTexto}${rehacerTexto}
DISCOS QUE YA CONOCE O YA SE LE MOSTRARON (NO los repitas):
${evitarTexto}

DISCOS DE DÍAS RECIENTES (tampoco los repitas):
${input.recientesTexto}

Propón el disco de descubrimiento de hoy. Responde el JSON ahora.`;

  const raw = await llm({
    system,
    user,
    temperature: 0.8, // más variedad: cada día un disco distinto
    maxTokens: 300,
    timeoutMs: LLM_TIMEOUT_MS,
  });

  const parsed = extractJson<{
    title?: string;
    artist?: string;
    year?: number;
    reason?: string;
  }>(raw);

  if (!parsed.title || !parsed.artist) {
    throw new Error(`Propuesta del LLM incompleta: ${raw.slice(0, 200)}`);
  }

  return {
    title: parsed.title.trim(),
    artist: parsed.artist.trim(),
    year: typeof parsed.year === "number" ? parsed.year : null,
    reason: (parsed.reason ?? "").trim(),
  };
}
