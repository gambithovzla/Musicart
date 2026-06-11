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
  id: string;       // question id
  answer: string;   // opción elegida
  extra?: string;   // texto libre opcional
  date: string;     // YYYY-MM-DD
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

/** Últimas N curiosidades respondidas, formateadas para el prompt del LLM. */
export function formatCuriosities(answers: CuriosityAnswer[], limit = 8): string {
  if (!answers.length) return "";
  return answers
    .slice(-limit)
    .map((a) => {
      const q = QUESTIONS.find((q) => q.id === a.id);
      const pregunta = q?.text ?? a.id;
      return `- ${pregunta} → "${a.answer}"${a.extra ? ` (añadió: "${a.extra.slice(0, 100)}")` : ""}`;
    })
    .join("\n");
}
