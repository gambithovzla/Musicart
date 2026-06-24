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
  /** Voz del curador elegido por el usuario (tono de la "reason"). */
  voz?: string;
  /** Patrones de escucha detectados del historial (mood→género, racha, estación). */
  patronesTexto?: string | null;
  /** Pedido del oyente en lenguaje natural para el disco de hoy ("rock con
   *  energía", "algo tipo Linkin Park"). Lo escribe en el gate del día (o el
   *  admin al rehacer) y MANDA por encima del gusto histórico. */
  peticion?: string | null;
  /** Artistas recomendados en días recientes: NO repetir el mismo artista
   *  (variedad), salvo que el oyente lo pida explícitamente. */
  artistasRecientes?: string[];
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

  // Pedido explícito del oyente para hoy: manda por encima del gusto, el ánimo y
  // los patrones. Sigue intacta la regla anti-alucinación (disco real y documentado).
  const peticionTexto = input.peticion?.trim()
    ? `\nLO QUE EL OYENTE PIDIÓ ESCUCHAR HOY (MÁXIMA PRIORIDAD): «${input.peticion.trim()}».
Este pedido MANDA por encima del gusto histórico, el ánimo y los patrones de escucha.
- Si nombra un GÉNERO, IDIOMA, ÉPOCA, ESTILO o ENERGÍA, cúmplelo al pie de la letra.
- Si pide EXPLÍCITAMENTE un artista ("quiero a X", "ponme algo de X"), puedes proponer ese artista aunque salga en "artistas recientes".
- REFERENCIAS COMO INSPIRACIÓN: si menciona discos o artistas para describir cómo quiere SENTIRSE ("algo que me haga sentir como X", "en la vena de X", "parecido a X", "como Y me hizo sentir"), esos nombres son EJEMPLOS para que te inspires, NO discos para recomendárselos: el oyente YA los conoce de sobra. PROHIBIDO proponer el mismo disco que puso de referencia y, salvo que insista, también su mismo artista. Propón algo DISTINTO que comparta ese nervio, esa emoción o esa escena.
- IDIOMA IMPLÍCITO: aunque el idioma del día sea "Cualquiera", si el pedido o sus referencias apuntan claramente a un idioma o escena (p. ej. menciona artistas que cantan en español), respeta ese idioma al elegir.
Sigue siendo OBLIGATORIO que sea un álbum de estudio REAL y bien documentado (regla 2 y 3). En la "reason", conecta el disco con lo que pidió (sin prometer que suena idéntico a sus referencias). Solo si es imposible cumplirlo con un disco real, elige lo más cercano y dilo con honestidad en la "reason".\n`
    : "";

  // Variedad de artistas: si en días recientes ya sonaron ciertos artistas, NO
  // repetir el mismo (salvo petición explícita). Evita el "siempre el mismo".
  const artistasRecientes = (input.artistasRecientes ?? [])
    .map((a) => a.trim())
    .filter(Boolean);
  const artistasRecientesTexto =
    artistasRecientes.length > 0 && !input.peticion?.trim()
      ? `\nARTISTAS DE DÍAS RECIENTES (NO repitas el mismo artista hoy; trae uno DISTINTO para ampliar su mundo): ${[...new Set(artistasRecientes)].join(", ")}\n`
      : "";

  const idiomaRegla = input.lang
    ? `\n8. IDIOMA DE HOY: el usuario eligió escuchar en "${input.lang}" hoy. OBLIGATORIO proponer un disco donde el artista cante principalmente en ese idioma — el idioma del día va por encima del gusto. Solo si no existe ningún disco decente en ese idioma puedes elegir el más cercano, y debes mencionarlo en la "reason".\n   ATENCIÓN — los idiomas son distintos entre sí: "Español" (castellano, hispanohablante) ≠ "Português" (Brasil, Portugal) ≠ "Français" ≠ "English" ≠ "Italiano". No confundas lenguas romances ni des por válido un disco en portugués cuando pidieron español, ni uno en francés cuando pidieron italiano. Sé estricto: si dudas del idioma principal de un artista, elige otro del que estés seguro.`
    : "";

  const vozCurador = input.voz?.trim()
    ? `${input.voz.trim()} Hablas en español y de "tú".`
    : `Eres cercano y melómano, hablas en español y de "tú".`;

  const system = `Eres el curador musical de Musicart. ${vozCurador}
Tu trabajo HOY: proponer UN disco real para que esta persona lo DESCUBRA, elegido de TODA la música grabada (cualquier época, país, género), no de una lista cerrada.
La VOZ aplica al tono de la "reason" — los datos y la propuesta no cambian.

Reglas estrictas:
1. Responde SOLO un objeto JSON: {"title": "...", "artist": "...", "year": 1979, "reason": "..."} — sin texto extra.
2. Debe ser un disco REAL y bien documentado (que exista en MusicBrainz/Wikipedia), con su título y artista exactos. Nada inventado.
3. Debe ser un ÁLBUM DE ESTUDIO ORIGINAL y CANÓNICO (el disco "de verdad" del artista, varias canciones). ESTO ES CLAVE para que el oyente lo ENCUENTRE en Spotify/Apple/YouTube:
   - PROHIBIDO: sencillos (singles), EPs y, sobre todo, RECOPILATORIOS / grandes éxitos / antologías / "lo esencial" / colecciones / discos en vivo. Estos son los que peor se encuentran en streaming (hay mil versiones y a veces ni están).
   - NO propongas títulos que contengan o sean del estilo: "Grandes Éxitos", "Lo Esencial", "Lo Mejor de", "Obras Cumbres", "Antología", "Colección", "Esenciales", "Greatest Hits", "Best of", "The Essential", "Collection", "Anthology", "Singles", "Live", "En Vivo", "Unplugged", "MTV Unplugged".
   - En su lugar, elige el ÁLBUM DE ESTUDIO concreto donde están esas canciones (ej.: de Los Fabulosos Cadillacs propón «Vasos Vacíos» o «Rey Azúcar», NUNCA «Lo Esencial» ni «Obras Cumbres»). Si dudas, elige el álbum de estudio más reconocido de ese artista, no la recopilación.
4. DESCUBRIMIENTO Y AMPLIACIÓN: tu misión es ENSANCHAR su mundo musical, no devolverle lo que ya escucha. Elige algo que probablemente NO conozca: un puente desde lo que ama hacia un territorio nuevo (otro artista, otra escena, otro país, otra época). El gusto es la rampa de despegue, no una jaula. Mejor un disco que sienta suyo PERO que lo lleve un paso más allá, que uno idéntico a su zona de confort.
5. VARIEDAD ANTE TODO: NO te quedes orbitando a sus 2-3 artistas favoritos ni a un solo género. Respeta su gusto como punto de partida, pero CADA DÍA abre una puerta distinta. Un rockero recibe rock variado (eras, países, subgéneros) y de vez en cuando un puente bien justificado a algo vecino; nunca el mismo artista dos veces en pocos días. Evita repetir artista, escena y sonido de los discos recientes (lista abajo).
6. NO propongas ninguno de los discos que ya se le mostraron o que ya reseñó (lista abajo). Cada día es un disco distinto, y a poder ser de un ARTISTA distinto.
7. "reason": 1 a 3 frases cálidas y concretas, citando SOLO señales reales del usuario que aparecen abajo (sus estrellas, sus respuestas, su perfil, su ánimo). PROHIBIDO inventar datos del usuario.
   CONECTA CON SU HISTORIA, pero con NATURALIDAD, nunca a la fuerza. Tienes muchas señales para arrancar: lo que BUSCA en un disco, su ánimo de hoy, sus géneros e idiomas, un comentario suyo o un disco que amó. Elige el HILO que DE VERDAD encaje con el disco de hoy, no siempre el mismo.
   - Solo nombra un disco que amó como puente cuando comparta algo REAL con el de hoy: género, época, país/escena, emoción o energía ("como te voló «X», hoy…").
   - PROHIBIDO comparar discos de mundos musicales ajenos (p. ej. enganchar un bolero clásico con un disco de electrónica, o un disco de rock con uno de reguetón): suena impostado y absurdo, y se nota que es una muletilla. Si su disco favorito es de otro universo sonoro, NO lo menciones como referencia: conecta por lo que BUSCA, por su ánimo, por el género/idioma que aplica, o habla del disco de hoy por su propio encanto.
   - NO te apoyes SIEMPRE en el mismo disco favorito; varía la señal con la que abres para que no suene a plantilla.${idiomaRegla}`;

  const user = `PERFIL DEL USUARIO:
${input.perfilTexto}
${input.patronesTexto ? `\n${input.patronesTexto}\n` : ""}
SU DIARIO (reseñas recientes, de la más nueva a la más vieja):
${input.diarioTexto}

ÁNIMO DE HOY: ${input.mood ?? "(no indicado)"}
${peticionTexto}${artistasRecientesTexto}${regresoTexto}${rehacerTexto}
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
