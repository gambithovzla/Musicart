// Adapter de LLM intercambiable: OpenAI o Anthropic vía variables de entorno.
// LLM_PROVIDER=openai|anthropic · LLM_MODEL (runtime barato) ·
// GENERATION_MODEL (solo dossier: generate + verify, Fase 6.8)
//
// OJO con OpenAI: hay DOS dialectos. Los modelos clásicos (gpt-4o, gpt-4o-mini)
// usan `max_tokens` + `temperature`; los de razonamiento (o1, o3, o4, gpt-5)
// PROHÍBEN los dos y usan `max_completion_tokens`. Aquí se elige el dialecto por
// el nombre del modelo y, si la API se queja igual, se reintenta con el otro.

type LlmOptions = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number; // default 120 s (pipeline); la recomendación en runtime usa uno corto
  /** Override explícito; si no, usa LLM_MODEL (runtime) o GENERATION_MODEL (dossier). */
  model?: string;
};

function getProvider(): "openai" | "anthropic" {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicit === "openai" || explicit === "anthropic") {
    return explicit;
  }
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  throw new Error(
    "No hay clave de IA configurada. Define OPENAI_API_KEY o ANTHROPIC_API_KEY en .env",
  );
}

function runtimeModel(): string {
  const provider = getProvider();
  if (process.env.LLM_MODEL) return process.env.LLM_MODEL;
  return provider === "openai" ? "gpt-4o-mini" : "claude-sonnet-4-6";
}

/** Modelo para escribir/verificar dossiers (premium si está configurado). */
export function generationModel(): string {
  return process.env.GENERATION_MODEL || runtimeModel();
}

/** Modelo del runtime (elegir del catálogo, verificar el pedido, chat). Para el
 *  panel del dueño: saber CON QUÉ está hablando la app es medio diagnóstico. */
export function runtimeModelName(): string {
  return runtimeModel();
}

/** ¿Ese modelo habla el dialecto de razonamiento? Para contarlo en el panel:
 *  saber CÓMO se le está hablando al modelo es la mitad del diagnóstico. */
export function usaDialectoDeRazonamiento(model: string): boolean {
  try {
    return getProvider() === "openai" && esDeRazonamiento(model);
  } catch {
    // Sin clave no hay proveedor que valga: el panel ya lo dice por su lado.
    return false;
  }
}

/** ¿Hay una clave de IA configurada? Para decidir si podemos fabricar discos en vivo. */
export function hayClaveIA(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

/**
 * ¿Este modelo de OpenAI es de la familia de RAZONAMIENTO (o1, o3, o4, gpt-5…)?
 *
 * Importa porque esa familia cambió el contrato de la API y lo hizo en silencio
 * para quien no lo sabe: `max_tokens` está PROHIBIDO (ahora es
 * `max_completion_tokens`) y `temperature` solo admite su valor por defecto.
 * Mandar los de siempre devuelve 400 en TODAS las llamadas — con la cuenta
 * llena de saldo. Y como en runtime toda llamada caída tiene su red (catálogo,
 * rotación), el síntoma que llega al oyente no es "la IA falla": es "me repite
 * los discos y no me lee lo que le pido". Poner un modelo nuevo en
 * `GENERATION_MODEL` no puede costar eso.
 */
function esDeRazonamiento(model: string): boolean {
  const m = model.toLowerCase().replace(/^openai\//, "");
  return /^o\d/.test(m) || m.startsWith("gpt-5");
}

/** El esfuerzo de razonamiento se puede pedir bajo; o1 (la primera hornada) no lo admite. */
function admiteEsfuerzo(model: string): boolean {
  const m = model.toLowerCase().replace(/^openai\//, "");
  return !m.startsWith("o1");
}

/** Un 400 que se queja justo de los parámetros que cambiaron de nombre. */
function esQuejaDeParametros(texto: string): boolean {
  const t = texto.toLowerCase();
  return (
    t.includes("max_tokens") ||
    t.includes("max_completion_tokens") ||
    t.includes("temperature")
  );
}

/** Cuerpo de la petición, en el dialecto que toque. */
function cuerpoOpenAI(
  opts: LlmOptions,
  model: string,
  comoRazonamiento: boolean,
): Record<string, unknown> {
  const messages = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];
  if (!comoRazonamiento) {
    return {
      model,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 4096,
      messages,
    };
  }
  return {
    model,
    // Sin `temperature`: estos modelos solo aceptan la suya y rechazan el resto.
    // Y el tope cuenta TAMBIÉN los tokens de razonamiento, que el modelo gasta
    // antes de escribir una sola letra: con el tope de siempre (300 para una
    // propuesta) la respuesta llega VACÍA, que es un fallo aún más difícil de
    // leer que un error. Por eso se le añade un colchón.
    max_completion_tokens: (opts.maxTokens ?? 4096) + 2000,
    ...(admiteEsfuerzo(model) ? { reasoning_effort: "low" } : {}),
    messages,
  };
}

async function callOpenAI(opts: LlmOptions, model: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Falta OPENAI_API_KEY en .env");

  // Empezamos por el dialecto que le corresponde al nombre del modelo… pero si
  // la API se queja de los parámetros, cambiamos de dialecto y reintentamos UNA
  // vez. Así el día que salga otro modelo con otro nombre, la app se adapta sola
  // en vez de pasarse el día entero sirviendo discos repetidos.
  let comoRazonamiento = esDeRazonamiento(model);

  for (let intento = 0; intento < 2; intento++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cuerpoOpenAI(opts, model, comoRazonamiento)),
      // Un plazo nuevo por intento: el anterior ya viene consumido.
      signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
    });

    if (!res.ok) {
      const texto = (await res.text()).slice(0, 300);
      if (res.status === 400 && intento === 0 && esQuejaDeParametros(texto)) {
        console.warn(
          `[llm] ${model} rechazó los parámetros (${texto.slice(0, 120)}); ` +
            `reintento con el dialecto ${comoRazonamiento ? "clásico" : "de razonamiento"}.`,
        );
        comoRazonamiento = !comoRazonamiento;
        continue;
      }
      throw new Error(`OpenAI ${res.status}: ${texto}`);
    }

    const data = (await res.json()) as {
      choices: { message: { content: string | null }; finish_reason?: string }[];
    };
    const contenido = data.choices[0]?.message.content ?? "";
    if (!contenido.trim()) {
      // Respuesta vacía = fallo, y hay que decirlo con su nombre. Si llega aquí
      // callando, quien la recibe solo ve "no contiene JSON" y se pierde el
      // dato que importa: el modelo se quedó sin tope antes de escribir.
      const razon = data.choices[0]?.finish_reason ?? "desconocida";
      throw new Error(
        `OpenAI ${model} devolvió una respuesta vacía (finish_reason: ${razon})` +
          `${razon === "length" ? " — se quedó sin tope de tokens" : ""}`,
      );
    }
    return contenido;
  }

  throw new Error(`OpenAI ${model}: no se pudo completar la llamada`);
}

async function callAnthropic(opts: LlmOptions, model: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Falta ANTHROPIC_API_KEY en .env");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
  });
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    content: { type: string; text?: string }[];
    stop_reason?: string;
  };
  const contenido = data.content.find((b) => b.type === "text")?.text ?? "";
  if (!contenido.trim()) {
    throw new Error(
      `Anthropic ${model} devolvió una respuesta vacía (stop_reason: ${data.stop_reason ?? "desconocida"})`,
    );
  }
  return contenido;
}

async function callLlm(opts: LlmOptions, model: string): Promise<string> {
  return getProvider() === "openai"
    ? callOpenAI(opts, model)
    : callAnthropic(opts, model);
}

/** Runtime: recomendaciones, chat, curiosidades del día (modelo barato). */
export async function llm(opts: LlmOptions): Promise<string> {
  return callLlm(opts, opts.model ?? runtimeModel());
}

/** Pipeline de dossier: redacción y verificación (GENERATION_MODEL si existe). */
export async function llmGeneration(opts: LlmOptions): Promise<string> {
  return callLlm(opts, opts.model ?? generationModel());
}

// Extrae el primer objeto JSON de una respuesta (tolera ```json ... ``` y texto extra).
export function extractJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`La respuesta del LLM no contiene JSON: ${raw.slice(0, 200)}`);
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
