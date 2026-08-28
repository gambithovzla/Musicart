// Preguntas del día: micro-encuestas para conocer mejor al oyente.
// Una pregunta por día (rotación determinista). Las respuestas quedan en el
// perfil del usuario (campo curiosities en answersJson) y el motor de
// recomendación las usa como contexto adicional al elegir el disco.

export type CuriosityQuestion = {
  id: string;
  text: string;
  options: string[];
};

export type CuriosityAnswer = {
  id: string;        // question id (estático o "ai-YYYY-MM-DD")
  question?: string; // texto de la pregunta (necesario para preguntas IA)
  answer: string;    // opción elegida
  extra?: string;    // texto libre opcional
  date: string;      // YYYY-MM-DD
};

export const QUESTIONS: CuriosityQuestion[] = [
  {
    id: "feel-now",
    text: "¿Cómo te sientes ahora mismo?",
    options: ["En paz", "Nostálgico/a", "Con energía", "Reflexivo/a", "Cansado/a", "Emocionado/a"],
  },
  {
    id: "free-afternoon",
    text: "Si tuvieras toda la tarde libre, ¿qué harías?",
    options: ["Salir a caminar", "Ver una película", "Salir con amigos", "Quedarme en casa", "Crear algo", "Dormir"],
  },
  {
    id: "letters",
    text: "¿Qué tan importantes son las letras para ti?",
    options: ["Son todo", "Muy importantes", "Más o menos", "No me importan", "Prefiero sin letras"],
  },
  {
    id: "week",
    text: "¿Cómo va tu semana?",
    options: ["Con energía", "Tranquila", "Caótica", "Productiva", "Lenta"],
  },
  {
    id: "time-of-day",
    text: "¿Cuál es tu momento del día favorito?",
    options: ["La mañana", "El mediodía", "La tarde", "La noche", "La madrugada"],
  },
  {
    id: "nostalgia",
    text: "¿Qué tan nostálgico/a te sientes últimamente?",
    options: ["Mucho", "Un poco", "Nada", "Más bien optimista"],
  },
  {
    id: "surprise",
    text: "¿Prefieres que te sorprendan o ir a lo conocido?",
    options: ["Sorpréndeme siempre", "Mezcla de los dos", "Algo familiar primero", "Lo conocido, gracias"],
  },
  {
    id: "volume",
    text: "¿Cómo escuchas música?",
    options: ["A todo volumen", "Normal", "De fondo", "Con audífonos y me aislo", "Siempre acompañado/a"],
  },
  {
    id: "memory",
    text: "¿Qué recuerdo te trae la música?",
    options: ["La infancia", "Un amor", "Un viaje", "Amigos", "Un lugar", "Emociones sin palabras"],
  },
  {
    id: "genre-mood",
    text: "¿Qué te pide el cuerpo hoy?",
    options: ["Algo suave", "Algo con ritmo", "Algo épico", "Algo raro y distinto", "Sorpréndeme"],
  },
  {
    id: "philosophy",
    text: "¿Buscas significado en las canciones?",
    options: ["Siempre, es lo más importante", "A veces", "Depende del momento", "No, me quedo con el sonido"],
  },
  {
    id: "era",
    text: "¿Con qué época conectas más?",
    options: ["60-70s", "80s", "90s", "2000s", "Lo que sea si es bueno"],
  },
  {
    id: "night",
    text: "¿Qué tipo de noche fue ayer?",
    options: ["Tranquila", "Social y divertida", "Productiva", "Insomne", "Corta"],
  },
  {
    id: "world",
    text: "¿Qué te importa más en la vida ahora mismo?",
    options: ["La familia", "El trabajo / proyectos", "La salud", "Los amigos", "Crecer por dentro"],
  },
  {
    id: "discovery",
    text: "¿Qué tanto disfrutas descubrir algo nuevo?",
    options: ["Es lo que más busco", "Me gusta cuando pasa", "Depende de mi ánimo", "Prefiero lo que ya conozco"],
  },
];

/** Pregunta de hoy para este usuario: rota por día, salteando las ya respondidas. */
export function todayQuestion(
  answeredIds: Set<string>,
  dateKey: string, // YYYY-MM-DD
): CuriosityQuestion | null {
  const unanswered = QUESTIONS.filter((q) => !answeredIds.has(q.id));
  if (unanswered.length === 0) return null;

  // Semilla determinista por fecha (varía cada día pero es estable en el día).
  const seed = dateKey.split("-").reduce((acc, n) => acc + parseInt(n, 10), 0);
  return unanswered[seed % unanswered.length];
}

// ─── El paso del tiempo ──────────────────────────────────────────────────────
// Una respuesta del día es una FOTO DE ESE DÍA, no un rasgo de por vida. Sin
// esto, el oyente contesta una vez "montaña" en un "¿montaña o playa?" y seis
// meses después el curador le sigue escribiendo escenas de montaña: la respuesta
// entraba al prompt sin fecha, en la misma lista que sus géneros favoritos, y
// para el modelo era tan permanente como ellos. Aquí caduca.

/** Mientras es reciente, la respuesta vale como color de AHORA. */
export const DIAS_FRESCA = 14;

/** Pasado esto ya no se le cuenta al curador: fue de otra época del oyente. */
export const DIAS_OLVIDO = 120;

/** Cuántas respuestas frescas y cuántas viejas caben en el prompt. */
const MAX_FRESCAS = 6;
const MAX_VIEJAS = 3;

/** Días entre dos fechas YYYY-MM-DD. `null` si la respuesta no tiene fecha. */
export function diasDesde(fecha: string | undefined, hoy: string): number | null {
  if (!fecha || !hoy) return null;
  const a = Date.parse(`${fecha}T00:00:00Z`);
  const b = Date.parse(`${hoy}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** "hace 3 días", "hace 2 meses" — para que el curador SEPA cuándo se dijo. */
export function haceCuanto(dias: number | null): string {
  if (dias === null) return "sin fecha";
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 31) {
    const semanas = Math.round(dias / 7);
    return semanas <= 1 ? "hace una semana" : `hace ${semanas} semanas`;
  }
  const meses = Math.round(dias / 30);
  return meses <= 1 ? "hace un mes" : `hace ${meses} meses`;
}

/** Una respuesta con su antigüedad ya calculada. */
export type CuriosityConEdad = CuriosityAnswer & { dias: number | null };

/** El texto de la pregunta (las de IA la traen dentro; las estáticas, por id). */
export function textoDePregunta(a: CuriosityAnswer): string {
  return a.question ?? QUESTIONS.find((q) => q.id === a.id)?.text ?? a.id;
}

/** Respuestas de la más nueva a la más vieja, con su antigüedad. */
export function ordenarPorFecha(
  answers: CuriosityAnswer[],
  hoy: string,
): CuriosityConEdad[] {
  return answers
    .map((a) => ({ ...a, dias: diasDesde(a.date, hoy) }))
    .sort((x, y) => (x.dias ?? 9_999) - (y.dias ?? 9_999));
}

export type FormatCuriositiesOpts = {
  /** Fecha de hoy (YYYY-MM-DD) para calcular la antigüedad. */
  hoy?: string;
  /** Filtro extra: devuelve `true` para dejar FUERA una respuesta (p. ej. la que
   *  el curador ya gastó en la razón de ayer — ver `reason-guard`). */
  excluir?: (respuesta: CuriosityAnswer) => boolean;
};

/**
 * Las curiosidades formateadas para el prompt, FECHADAS y en dos bloques:
 * lo de estos días (color válido para hoy) y lo de hace tiempo (contexto, con
 * el aviso explícito de que fue puntual). Lo anterior a `DIAS_OLVIDO` no entra.
 */
export function formatCuriosities(
  answers: CuriosityAnswer[],
  opts: FormatCuriositiesOpts | number = {},
): string {
  // Compatibilidad: antes el segundo argumento era un simple `limit`.
  const o: FormatCuriositiesOpts = typeof opts === "number" ? {} : opts;
  const hoy = o.hoy ?? new Date().toISOString().slice(0, 10);
  if (!answers.length) return "";

  const utiles = ordenarPorFecha(answers, hoy).filter(
    (a) => !(o.excluir?.(a) ?? false),
  );
  const linea = (a: CuriosityConEdad) =>
    `- [${haceCuanto(a.dias)}] ${textoDePregunta(a)} → "${a.answer}"` +
    (a.extra ? ` (añadió: "${a.extra.slice(0, 100)}")` : "");

  const frescas = utiles
    .filter((a) => a.dias !== null && a.dias <= DIAS_FRESCA)
    .slice(0, MAX_FRESCAS);
  // Sin fecha no sabemos cuándo fue: se trata como vieja (es lo prudente).
  const viejas = utiles
    .filter((a) => a.dias === null || (a.dias > DIAS_FRESCA && a.dias <= DIAS_OLVIDO))
    .slice(0, MAX_VIEJAS);

  const bloques: string[] = [];
  if (frescas.length) {
    bloques.push(
      `Lo que me contó estos días (respuestas a la pregunta del día — son del MOMENTO, no rasgos suyos):
` +
        frescas.map(linea).join("\n"),
    );
  }
  if (viejas.length) {
    bloques.push(
      `De hace tiempo (fue de aquel día concreto; NO es una constante suya ni una escena de su vida — úsalo solo como contexto de fondo):\n` +
        viejas.map(linea).join("\n"),
    );
  }
  return bloques.join("\n\n");
}
