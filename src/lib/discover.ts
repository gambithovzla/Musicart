// Fase 6 — El disco fresco del día.
// En vez de elegir entre los discos ya publicados, la IA PROPONE un disco real
// de toda la música grabada para que este usuario lo descubra hoy, según su
// gusto, su diario y su ánimo. Luego el pipeline (facts → narra → verifica) lo
// fabrica. Así cada día nace un disco nuevo, personalizado — no uno "sembrado".

import { llm, llmGeneration, extractJson } from "./dossier/llm";

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
Sigue siendo OBLIGATORIO que sea un álbum de estudio REAL y bien documentado (regla 2 y 3). En la "reason", conecta el disco con lo que pidió (sin prometer que suena idéntico a sus referencias).
- PROHIBIDO ABSOLUTO proponer un disco de OTRO género del que pidió y justificarlo con que "su energía resuena" o "aunque no es un X clásico…". Si pidió un género (bolero, salsa, jazz, metal…), el disco DEBE ser de ese género de verdad — de toda la música grabada existen cientos de discos canónicos de cada género, así que NUNCA es "imposible". Caer en un favorito del perfil que no encaja con el pedido es el peor error que puedes cometer aquí.\n`
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
    ? `\n9. IDIOMA DE HOY: el usuario eligió escuchar en "${input.lang}" hoy. OBLIGATORIO proponer un disco donde el artista cante principalmente en ese idioma — el idioma del día va por encima del gusto. Solo si no existe ningún disco decente en ese idioma puedes elegir el más cercano, y debes mencionarlo en la "reason".\n   ATENCIÓN — los idiomas son distintos entre sí: "Español" (castellano, hispanohablante) ≠ "Português" (Brasil, Portugal) ≠ "Français" ≠ "English" ≠ "Italiano". No confundas lenguas romances ni des por válido un disco en portugués cuando pidieron español, ni uno en francés cuando pidieron italiano. Sé estricto: si dudas del idioma principal de un artista, elige otro del que estés seguro.`
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
   - NO te apoyes SIEMPRE en el mismo disco favorito; varía la señal con la que abres para que no suene a plantilla.
8. NO REPITAS EL MISMO GANCHO: en "DISCOS DE DÍAS RECIENTES" abajo, junto a cada disco reciente, verás la razón que le diste ese día. PROHIBIDO abrir la razón de HOY con la misma anécdota, dato o escena que ya usaste ahí (p. ej. si en un día reciente hablaste de que maneja por la montaña, HOY queda prohibida esa imagen). Revisa esas razones y elige un ángulo distinto del perfil, el diario o el ánimo de hoy.${idiomaRegla}`;

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

  // Elegir QUÉ disco proponer de entre TODA la música es el paso que más
  // conocimiento musical exige: el modelo barato gravita a los mismos 15-20
  // discos megafamosos (justo los que el oyente ya conoce) y nos empuja a
  // repetir. Por eso el proponedor usa GENERATION_MODEL (premium) si está
  // configurado; sin esa variable, sigue con el modelo barato de runtime — el
  // costo por defecto no cambia, pero el dueño tiene la palanca para más variedad.
  const raw = await llmGeneration({
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

/**
 * Barrera dura del pedido: cuando el oyente pidió algo concreto hoy ("un bolero",
 * "rock con energía", "algo en francés"), verificamos con el LLM que el disco
 * propuesto DE VERDAD cumple ese pedido — no que se le "parezca" o "resuene".
 *
 * Por qué existe: el proponedor a veces reconoce que el disco no encaja ("aunque
 * no es un bolero clásico…") y lo recomienda igual, cayendo en un favorito del
 * perfil. Los arreglos de prompt no bastaron; esta es la barrera en código,
 * gemela de la barrera anti-repetición. Si no cumple, quien llama reintenta o cae
 * al catálogo. Ante la duda devolvemos `true` (no bloqueamos de más): solo
 * cortamos los desajustes claros (pidió un género y el disco es de otro mundo).
 *
 * Las REFERENCIAS de inspiración ("algo tipo Linkin Park", "como me hizo sentir
 * X") NO son un pedido de ese disco/artista: ahí basta que comparta el espíritu.
 */
export async function discoCumplePedido(input: {
  peticion: string;
  title: string;
  artist: string;
  lang: string | null;
}): Promise<{ cumple: boolean; motivo: string }> {
  const system = `Eres un crítico musical estricto que controla la calidad de una recomendación.
El oyente pidió algo concreto para hoy y otra IA propuso un disco. Tu única tarea: decir si el disco CUMPLE el pedido.

Reglas:
1. Responde SOLO JSON: {"cumple": true|false, "motivo": "..."} — sin texto extra.
2. Si el pedido nombra un GÉNERO, ESTILO, ÉPOCA, IDIOMA o ENERGÍA, el disco debe encajar DE VERDAD en eso. Un disco de otro género NO cumple, por bueno que sea. Ejemplo: si pidió "bolero" y el disco es flamenco/pop, "cumple": false.
3. EXCEPCIÓN — referencias de inspiración: si el pedido usa un artista o disco como ejemplo de cómo quiere SENTIRSE ("algo tipo X", "en la vena de Y", "como me hizo sentir Z"), basta con que el disco comparta ese espíritu, energía o escena; NO hace falta que sea el mismo artista. Ahí sé generoso.
4. Ante la duda razonable, "cumple": true. Solo marca false cuando el desajuste es CLARO.
5. Juzga por tu conocimiento musical del disco y el artista, no por lo que diga nadie.`;

  const user = `PEDIDO DEL OYENTE: «${input.peticion.trim()}»${
    input.lang ? `\nIDIOMA QUE PIDIÓ HOY: ${input.lang}` : ""
  }
DISCO PROPUESTO: «${input.title}» de ${input.artist}

¿Este disco cumple el pedido? Responde el JSON ahora.`;

  try {
    const raw = await llm({
      system,
      user,
      temperature: 0,
      maxTokens: 120,
      timeoutMs: LLM_TIMEOUT_MS,
    });
    const parsed = extractJson<{ cumple?: boolean; motivo?: string }>(raw);
    // Sin respuesta clara → no bloqueamos (evita falsos positivos que dejarían
    // al oyente sin disco fresco por un fallo del verificador).
    if (typeof parsed.cumple !== "boolean") {
      return { cumple: true, motivo: "verificador sin respuesta clara" };
    }
    return { cumple: parsed.cumple, motivo: (parsed.motivo ?? "").trim() };
  } catch {
    // Si el verificador falla, no penalizamos al oyente: dejamos pasar.
    return { cumple: true, motivo: "verificador no disponible" };
  }
}
