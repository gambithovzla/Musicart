// Generación del dossier narrativo. El LLM solo puede narrar sobre el facts payload.
//
// Segunda versión (nov 2026). La primera pedía las nueve secciones de golpe, con
// un número fijo de palabras cada una, a un modelo barato. Salía lo mismo en
// todos los discos: una apertura atmosférica ("Imagina un estudio…"), un
// párrafo de biografía y una moraleja ("sigue resonando hoy"). El dato bueno
// —en «Paranoid», que la discográfica obligó a cambiar el título— quedaba
// enterrado a mitad de párrafo.
//
// Ahora son tres pasos, como en una redacción de verdad:
//
//   1. EL EDITOR lee los hechos y decide el ÁNGULO: cuál es la historia de este
//      disco, con qué escena concreta se abre, qué detalles solo son ciertos de
//      él y qué es lo obvio que todo el mundo dice (para no decirlo).
//   2. EL REDACTOR escribe siguiendo ese plan, con un libro de estilo estricto y
//      una extensión que depende de cuánto se sabe (con poco material, texto
//      corto y honesto; nunca relleno).
//   3. LA BARRERA DE ESTILO (estilo.ts, sin IA) caza las muletillas que se hayan
//      colado y pide reescribir SOLO esas frases.
//
// El paquete de hechos viaja como contexto compartido (cacheado): los tres
// pasos y el verificador lo leen sin pagarlo entero cada vez.

import { llmRedaccion, extractJson } from "./llm";
import { detectarMuletillas, listaNegraParaPrompt, type Hallazgo } from "./estilo";
import type { DossierContent, FactsPayload } from "../types";

// ─── El paquete de hechos como contexto compartido ──────────────────────────

/** El payload tal cual lo leen editor, redactor y verificador (idéntico = cacheable). */
export function contextoDeHechos(payload: FactsPayload): string {
  // La marca de versión es nuestra, no un hecho del disco.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { redaccion, ...hechos } = payload;
  payload = hechos;
  return [
    "FACTS PAYLOAD — la ÚNICA fuente de verdad sobre este disco. Todo dato concreto",
    "(fecha, nombre, cifra, lugar, premio, anécdota) que se escriba tiene que estar aquí.",
    "",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

// ─── 1. El editor: el ángulo ────────────────────────────────────────────────

export type PlanEditorial = {
  angulo: string;
  apertura: string;
  tension?: string;
  detalles: string[];
  escucha: string[];
  obvio: string[];
  riqueza: "alta" | "media" | "baja";
};

const EDITOR = `Eres el editor jefe de Musicart, una revista musical diaria en español. Antes de que nadie escriba una línea, decides DE QUÉ VA la historia de este disco.

Lee el FACTS PAYLOAD y responde SOLO con JSON:
{
  "angulo": "La historia de este disco en UNA frase con sujeto, verbo y conflicto. No una valoración ('un clásico del metal') sino un relato ('una banda de Birmingham a la que la discográfica obligó a cambiar el título…'). Solo con hechos del payload.",
  "apertura": "La escena o el dato MÁS CONCRETO y sorprendente del payload para abrir: una persona haciendo algo, en un lugar o momento, o una decisión con consecuencias. Indica de qué parte del payload sale.",
  "tension": "Qué estaba en juego o qué conflicto hay (con la discográfica, la banda, la época, la crítica…), si el payload lo permite. Si no, omítelo.",
  "detalles": ["4 a 8 detalles que SOLO son ciertos de este disco: nombres propios, lugares, cifras, citas, decisiones, samples, colaboraciones. Cada uno con su fuente entre corchetes, p. ej. '[wikipedia:en:sección:Recording]'."],
  "escucha": ["2 a 4 cosas concretas para oír, atadas a una canción del tracklist: 'En «X», fíjate en…'. Puedes describir el sonido (eso es opinión), pero cualquier dato tiene que estar en el payload."],
  "obvio": ["1 a 3 lugares comunes que todo el mundo dice de este disco o de su género y que la historia NO debe repetir."],
  "riqueza": "alta | media | baja — cuánto material narrativo real trae el payload (alta: varias secciones con escenas y nombres; baja: poco más que título, año y tracklist)."
}

Si el payload es pobre, dilo con riqueza "baja" y no inventes ángulos: un ángulo modesto y cierto vale más que uno épico y falso.`;

function normalizarPlan(p: Partial<PlanEditorial> | null | undefined): PlanEditorial | null {
  if (!p || typeof p.angulo !== "string" || !p.angulo.trim()) return null;
  const lista = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 8) : [];
  const riqueza = p.riqueza === "alta" || p.riqueza === "baja" ? p.riqueza : "media";
  return {
    angulo: p.angulo.trim(),
    apertura: String(p.apertura ?? "").trim(),
    tension: p.tension ? String(p.tension).trim() : undefined,
    detalles: lista(p.detalles),
    escucha: lista(p.escucha).slice(0, 4),
    obvio: lista(p.obvio).slice(0, 3),
    riqueza,
  };
}

export async function planificarAngulo(payload: FactsPayload): Promise<PlanEditorial | null> {
  try {
    const raw = await llmRedaccion({
      contextoCompartido: contextoDeHechos(payload),
      system: EDITOR,
      user: `Disco: «${payload.album.title}» de ${payload.album.artist} (${payload.album.year}). Decide el ángulo.`,
      temperature: 0.4,
      maxTokens: 1800,
    });
    return normalizarPlan(extractJson<Partial<PlanEditorial>>(raw));
  } catch (err) {
    // Sin plan se puede escribir igual (peor, pero se escribe): el redactor
    // elige su propio ángulo con las mismas reglas.
    console.warn(`[dossier] el editor no respondió: ${(err as Error).message.slice(0, 160)}`);
    return null;
  }
}

// ─── 2. El redactor ─────────────────────────────────────────────────────────

const EXTENSION: Record<PlanEditorial["riqueza"], string> = {
  alta: "intro 260-360 palabras en 3-4 párrafos; artistStory 140-200; whyItMatters 110-160",
  media: "intro 180-260 palabras en 2-3 párrafos; artistStory 100-150; whyItMatters 90-130",
  baja: "intro 110-170 palabras en 2 párrafos; artistStory 60-110; whyItMatters 70-110. Hay poco material: sé breve y honesto (puedes decir que de este disco se sabe poco y contar bien lo que sí se sabe). NUNCA rellenes",
};

const REDACTOR = `Eres la mejor pluma de Musicart, una revista musical diaria para melómanos latinoamericanos. Escribes el dossier de un disco: la historia que hace que alguien quiera escucharlo entero HOY.

REGLA DE ORO — CERO INVENCIÓN
- Todo dato concreto (fecha, nombre, cifra, lugar, premio, anécdota, cita) tiene que estar en el FACTS PAYLOAD. Si no está, no existe.
- Tus opiniones estéticas y la descripción del sonido sí son tuyas: ahí está tu voz.
- Las fuentes en inglés son solo material: escribes SIEMPRE en español.

LIBRO DE ESTILO
1. Periodismo musical de revista, no folleto. Piensa en una crónica de Rockdelux o de la Rolling Stone en español: escenas, personas, decisiones, consecuencias.
2. Abre con la escena del plan: alguien haciendo algo concreto. PROHIBIDO abrir con "Imagina", "Corría el año", "En 19XX,", una pregunta retórica o una definición del género.
3. PRUEBA DE SUSTITUCIÓN: si una frase se puede pegar en el dossier de OTRO disco cambiando el nombre, bórrala y escribe una que solo sea cierta de este. Cada párrafo lleva al menos un detalle que solo es de este disco.
4. Sustantivos y verbos concretos. Fuera adjetivos de catálogo (icónico, legendario, emblemático, atemporal, mítico, imprescindible, revolucionario).
5. Ritmo: alterna frases largas con frases cortas. Una frase corta después de un dato fuerte pega más que un adjetivo.
6. Cierra con una imagen o una indicación concreta de escucha ("ponlo alto cuando llegue…"), nunca con moraleja ("sigue resonando hoy", "dejó una huella imborrable").
7. Español neutro latinoamericano ("ustedes", nunca "vosotros"). Tutea al lector.
8. Separa los párrafos con una línea en blanco (\\n\\n).
9. Títulos de canciones y discos entre comillas latinas: «War Pigs», «Paranoid». Las citas textuales de personas, entre comillas latinas o con raya; nunca comillas simples ('…').
10. Si citas a alguien que habló en inglés, tradúcelo con naturalidad al español (es una cita traducida, no la inventes).

LISTA NEGRA (no uses ninguna, ni parecidas): ${listaNegraParaPrompt()}.

EJEMPLO DE FORMA (banda inventada; sus datos NO existen para tu disco, solo mira cómo se escribe):
MAL: "Imagina un estudio en 1978 donde el aire está cargado de electricidad. Los Cometas se encontraban en un punto crucial de su carrera y crearon un álbum atemporal que sigue resonando hoy."
BIEN: "Les quedaban tres días de estudio pagados y ninguna canción para cerrar el lado B. El bajista trajo un riff que llevaba meses tocando en las pruebas de sonido; lo grabaron en dos tomas. Ese relleno de última hora es hoy la canción por la que la gente conoce a Los Cometas."

FORMATO — responde SOLO con un objeto JSON válido:
{
  "intro": "La historia detrás del disco, construida sobre el ángulo del plan. Escena de apertura → contexto y conflicto → qué salió de ahí → una invitación concreta a escucharlo.",
  "artistStory": "Quién era el artista EN ESE MOMENTO (no su biografía completa): de dónde venía, qué le pasaba, qué buscaba. Solo hechos del payload.",
  "whyItMatters": "Tu argumento como crítico: UNA idea concreta sobre por qué vale la pena hoy (qué hace este disco que otros no). Puedes apoyarte en hechos del payload; si das un dato, tiene que estar ahí.",
  "questions": ["3 preguntas para después de escuchar, cada una atada a una canción o un momento concreto del disco. Nada de '¿qué emociones te evoca?'."],
  "trackNotes": [{ "position": 1, "title": "título EXACTO del tracklist", "note": "1 frase (2 si hace falta): qué oír ahí (un instrumento, un cambio, una letra si está en el payload) o su historia verificable. Nunca 'una canción que…'." }],
  "wowFacts": ["2 a 4 '¿Sabías que…?' con datos concretos del payload. Prioriza conexiones (samples, versiones, colaboraciones), anécdotas de grabación y datos raros. Si el payload es pobre, menos (mín. 1)."],
  "jumps": [{ "title": "álbum destino", "artist": "artista destino", "connection": "1-2 frases: la relación REAL y documentada en el payload que une ambos discos" }],
  "difficulty": "ENTERO 1-5",
  "impact": "ENTERO 1-100",
  "impactNote": "2-3 frases con la evidencia concreta del payload (premios con nombre, certificaciones, listas, prensa). Si hay poca, dilo con honestidad."
}

trackNotes: OBLIGATORIO una entrada por CADA canción del tracklist (position y title EXACTOS).
jumps: 0 a 3. Solo relaciones respaldadas por el payload (colaboraciones, samples, miembros compartidos, productores, influencias documentadas). Si no hay, [].

difficulty (1-5): qué tan exigente es para un oído casual (1 = entra fácil, 5 = pide oído atento).
impact (1-100), IMPACTO CULTURAL HONESTO y conservador, calibrado con la evidencia del payload:
  · 90-100 hito que redefinió un género o una época · 75-89 clásico mayor, influyente más allá de su nicho
  · 60-74 importante en su género o país · 40-59 notable o exitoso, impacto histórico modesto
  · 20-39 repercusión local o de nicho · 1-19 sin evidencia de impacto
  Decide el tramo, elige un número concreto dentro (no siempre el centro). Si dudas, baja.`;

export type GeneratedDossier = DossierContent & {
  difficulty: number;
  impact: number;
};

// Convierte a entero acotado. Tolera que el LLM devuelva número o string ("64").
function aEntero(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

/** Alinea las notas al tracklist canónico (una por pista). */
export function alignTrackNotes(
  tracklist: FactsPayload["tracklist"],
  notes: DossierContent["trackNotes"],
): DossierContent["trackNotes"] {
  const byPos = new Map(notes.map((n) => [n.position, n]));
  const byTitle = new Map(notes.map((n) => [normTitle(n.title), n]));

  return tracklist.map((t) => {
    const found =
      byPos.get(t.position) ??
      byTitle.get(normTitle(t.title)) ??
      [...notes].find(
        (n) =>
          normTitle(n.title).includes(normTitle(t.title)) ||
          normTitle(t.title).includes(normTitle(n.title)),
      );
    return {
      position: t.position,
      title: t.title,
      note: found?.note?.trim() || undefined,
    };
  });
}

function planEnTexto(plan: PlanEditorial | null): string {
  if (!plan) {
    return "No hay plan del editor: decide tú el ángulo con las mismas reglas (escena concreta, detalles que solo son de este disco, nada de lugares comunes).";
  }
  return [
    "PLAN DEL EDITOR (síguelo):",
    `· Ángulo: ${plan.angulo}`,
    plan.apertura && `· Abre con: ${plan.apertura}`,
    plan.tension && `· Lo que estaba en juego: ${plan.tension}`,
    plan.detalles.length > 0 && `· Detalles a tejer:\n  - ${plan.detalles.join("\n  - ")}`,
    plan.escucha.length > 0 && `· Qué oír:\n  - ${plan.escucha.join("\n  - ")}`,
    plan.obvio.length > 0 && `· NO repitas estos lugares comunes: ${plan.obvio.join(" / ")}`,
    `· Extensión: ${EXTENSION[plan.riqueza]}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizarDossier(parsed: GeneratedDossier, payload: FactsPayload): GeneratedDossier {
  if (!parsed.intro || !parsed.artistStory || !parsed.whyItMatters) {
    throw new Error("El dossier generado está incompleto (faltan secciones).");
  }
  parsed.intro = String(parsed.intro).trim();
  parsed.artistStory = String(parsed.artistStory).trim();
  parsed.whyItMatters = String(parsed.whyItMatters).trim();
  parsed.questions = (parsed.questions ?? []).map((q) => String(q).trim()).filter(Boolean).slice(0, 4);
  parsed.trackNotes = alignTrackNotes(payload.tracklist, parsed.trackNotes ?? []);
  parsed.wowFacts = (parsed.wowFacts ?? [])
    .map((f) => f?.toString().trim())
    .filter(Boolean)
    .slice(0, 4) as string[];
  parsed.jumps = (parsed.jumps ?? [])
    .filter((j) => j?.title && j?.artist && j?.connection)
    .slice(0, 3);
  parsed.difficulty = aEntero(parsed.difficulty, 3, 1, 5);
  parsed.impact = aEntero(parsed.impact, 50, 1, 100);
  parsed.impactNote = parsed.impactNote?.toString().trim().slice(0, 600) || undefined;
  return parsed;
}

async function redactar(
  payload: FactsPayload,
  plan: PlanEditorial | null,
  feedback?: string,
): Promise<GeneratedDossier> {
  const user = [
    `Disco: «${payload.album.title}» de ${payload.album.artist} (${payload.album.year}).`,
    "",
    planEnTexto(plan),
    feedback
      ? `\nCORRECCIÓN REQUERIDA — tu intento anterior contenía afirmaciones sin respaldo en el payload. Elimínalas o reescríbelas sin esos datos (sin perder la escena ni el ángulo):\n${feedback}`
      : "",
  ].join("\n");

  const raw = await llmRedaccion({
    contextoCompartido: contextoDeHechos(payload),
    system: REDACTOR,
    user,
    temperature: 0.75,
    maxTokens: 8192,
  });
  return normalizarDossier(extractJson<GeneratedDossier>(raw), payload);
}

// ─── 3. La barrera de estilo ────────────────────────────────────────────────

const PULIDOR = `Eres el corrector de estilo de Musicart. Te paso frases de un dossier que usan muletillas de folleto. Reescribe CADA frase para que diga algo concreto y propio de este disco, usando SOLO hechos del FACTS PAYLOAD (o, si no hay dato que poner, quitando el adorno y dejando la frase más corta y llana). Mantén el sentido, el tono y la extensión aproximada. Nada de la lista negra.

Responde SOLO con JSON: { "reemplazos": [{ "original": "frase original EXACTA", "nueva": "frase reescrita" }] }`;

const CAMPOS_PROSA = ["intro", "artistStory", "whyItMatters", "impactNote"] as const;

function textosDeProsa(d: GeneratedDossier): Record<string, string | undefined> {
  return {
    intro: d.intro,
    artistStory: d.artistStory,
    whyItMatters: d.whyItMatters,
    impactNote: d.impactNote,
    ...Object.fromEntries((d.wowFacts ?? []).map((f, i) => [`wowFacts.${i}`, f])),
    ...Object.fromEntries(
      d.trackNotes.filter((t) => t.note).map((t) => [`track.${t.position}`, t.note]),
    ),
  };
}

function aplicarReemplazo(d: GeneratedDossier, h: Hallazgo, nueva: string): void {
  const sustituir = (texto: string | undefined) =>
    texto && texto.includes(h.frase) ? texto.replace(h.frase, nueva) : texto;
  if ((CAMPOS_PROSA as readonly string[]).includes(h.campo)) {
    const campo = h.campo as (typeof CAMPOS_PROSA)[number];
    const actual = d[campo];
    const nuevo = sustituir(actual ?? undefined);
    if (nuevo !== undefined) (d as Record<string, unknown>)[campo] = nuevo;
  } else if (h.campo.startsWith("wowFacts.")) {
    const i = Number(h.campo.split(".")[1]);
    if (d.wowFacts?.[i]) d.wowFacts[i] = sustituir(d.wowFacts[i]) ?? d.wowFacts[i];
  } else if (h.campo.startsWith("track.")) {
    const pos = Number(h.campo.split(".")[1]);
    const t = d.trackNotes.find((x) => x.position === pos);
    if (t?.note) t.note = sustituir(t.note);
  }
}

/** Reescribe solo las frases con muletillas. Nunca rompe: ante un fallo, deja el texto. */
export async function pulirEstilo(
  d: GeneratedDossier,
  payload: FactsPayload,
  log: (msg: string) => void = () => {},
): Promise<{ dossier: GeneratedDossier; muletillasRestantes: Hallazgo[] }> {
  const hallazgos = detectarMuletillas(textosDeProsa(d));
  if (hallazgos.length === 0) return { dossier: d, muletillasRestantes: [] };
  log(`Estilo: ${hallazgos.length} frase(s) de molde. Puliendo…`);
  try {
    const raw = await llmRedaccion({
      contextoCompartido: contextoDeHechos(payload),
      system: PULIDOR,
      user: hallazgos
        .map((h, i) => `${i + 1}. [${h.porque}] ${h.frase}`)
        .join("\n"),
      temperature: 0.6,
      maxTokens: 2500,
    });
    const { reemplazos } = extractJson<{ reemplazos?: { original?: string; nueva?: string }[] }>(raw);
    for (const h of hallazgos) {
      const r = (reemplazos ?? []).find(
        (x) => x?.original && x.nueva && (x.original.trim() === h.frase || h.frase.includes(x.original.trim())),
      );
      if (r?.nueva) aplicarReemplazo(d, h, r.nueva.trim());
    }
  } catch (err) {
    log(`Estilo: el pulido falló (${(err as Error).message.slice(0, 120)}); se deja el texto.`);
  }
  const restantes = detectarMuletillas(textosDeProsa(d));
  if (restantes.length > 0) {
    log(`Estilo: quedan ${restantes.length} muletilla(s): ${restantes.map((h) => h.porque).join(", ")}.`);
  }
  return { dossier: d, muletillasRestantes: restantes };
}

// ─── La operación completa ──────────────────────────────────────────────────

export type GeneracionOpciones = {
  feedback?: string;
  /** Si ya hay plan (reintento tras la verificación), no se vuelve a pagar. */
  plan?: PlanEditorial | null;
  log?: (msg: string) => void;
};

export type GeneracionResultado = GeneratedDossier & { plan: PlanEditorial | null };

export async function generateDossier(
  payload: FactsPayload,
  opciones: GeneracionOpciones | string = {},
): Promise<GeneracionResultado> {
  // Compatibilidad: antes el segundo argumento era el feedback a secas.
  const op: GeneracionOpciones = typeof opciones === "string" ? { feedback: opciones } : opciones;
  const log = op.log ?? (() => {});

  const plan = op.plan !== undefined ? op.plan : await planificarAngulo(payload);
  if (plan && op.plan === undefined) log(`Ángulo: ${plan.angulo}`);

  const borrador = await redactar(payload, plan, op.feedback);
  const { dossier } = await pulirEstilo(borrador, payload, log);
  return Object.assign(dossier, { plan });
}
