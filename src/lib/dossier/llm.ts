// Adapter de LLM intercambiable: OpenAI, Anthropic o DeepSeek por variables de
// entorno.
//   LLM_PROVIDER=openai|anthropic|deepseek   (runtime barato)
//   LLM_MODEL                                (runtime)
//   GENERATION_MODEL                         (propuestas: caminos, atlas, social)
//   DOSSIER_MODEL / DOSSIER_PROVIDER         (la pluma: quien escribe las historias)
//
// DeepSeek habla el dialecto de OpenAI (mismo cuerpo, misma respuesta): cambia
// solo la URL y la clave. Su `deepseek-chat` escribe en español muy por encima de
// gpt-4o-mini y cuesta una fracción de lo que cuesta Claude, así que es la opción
// natural para un producto que escribe cientos de historias.
//
// OJO con OpenAI: hay DOS dialectos. Los modelos clásicos (gpt-4o, gpt-4o-mini)
// usan `max_tokens` + `temperature`; los de razonamiento (o1, o3, o4, gpt-5)
// PROHÍBEN los dos y usan `max_completion_tokens`. Aquí se elige el dialecto por
// el nombre del modelo y, si la API se queja igual, se reintenta con el otro.

export type Proveedor = "openai" | "anthropic" | "deepseek";

type LlmOptions = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number; // default 120 s (pipeline); la recomendación en runtime usa uno corto
  /** Override explícito; si no, usa LLM_MODEL (runtime) o GENERATION_MODEL (dossier). */
  model?: string;
  /**
   * Contexto largo que se repite IGUAL en varias llamadas seguidas (el paquete
   * de hechos de un disco: lo leen el editor, el redactor y el verificador). Va
   * delante de todo para que el proveedor lo cachee: en Anthropic se marca con
   * cache_control (la relectura cuesta ~10%); en OpenAI el prefijo idéntico se
   * cachea solo. Sin esto, escribir con un modelo bueno costaba el triple.
   */
  contextoCompartido?: string;
};

function getProvider(): Proveedor {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicit === "openai" || explicit === "anthropic" || explicit === "deepseek") {
    return explicit;
  }
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.DEEPSEEK_API_KEY) return "deepseek";
  throw new Error(
    "No hay clave de IA configurada. Define OPENAI_API_KEY, ANTHROPIC_API_KEY o DEEPSEEK_API_KEY en .env",
  );
}

function modeloPorDefecto(provider: Proveedor): string {
  if (provider === "openai") return "gpt-4o-mini";
  if (provider === "anthropic") return "claude-sonnet-4-6";
  return "deepseek-chat";
}

/**
 * Un nombre de modelo que no es del proveedor que se va a usar es un 400
 * garantizado: si en Vercel quedó `LLM_MODEL=gpt-4o-mini` y se pone
 * `LLM_PROVIDER=deepseek`, le pediríamos a DeepSeek un modelo que no existe en
 * TODAS las llamadas. Como el síntoma no dice "modelo equivocado" sino "la IA
 * falla", aquí se ignora esa variable, se usa el modelo propio del proveedor y
 * se deja el aviso en el log.
 */
function modeloCompat(nombre: string | undefined, provider: Proveedor): string | undefined {
  const n = nombre?.trim();
  if (!n) return undefined;
  const suyo = proveedorDeModelo(n);
  if (suyo && suyo !== provider) {
    console.warn(
      `[llm] el modelo "${n}" no es de ${provider}; uso ${modeloPorDefecto(provider)}. ` +
        `Borra esa variable o cámbiala para dejar de ver este aviso.`,
    );
    return undefined;
  }
  return n;
}

function runtimeModel(): string {
  const provider = getProvider();
  return modeloCompat(process.env.LLM_MODEL, provider) ?? modeloPorDefecto(provider);
}

/** Modelo para escribir/verificar dossiers (premium si está configurado). */
export function generationModel(): string {
  const provider = getProvider();
  return modeloCompat(process.env.GENERATION_MODEL, provider) || runtimeModel();
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
    // DeepSeek tiene su propio razonador (deepseek-reasoner): razona antes de
    // escribir y no acepta `temperature`, igual que los o1/o3 de OpenAI.
    if (model.toLowerCase().includes("reasoner")) return true;
    return getProvider() === "openai" && esDeRazonamiento(model);
  } catch {
    // Sin clave no hay proveedor que valga: el panel ya lo dice por su lado.
    return false;
  }
}

/** ¿Hay una clave de IA configurada? Para decidir si podemos fabricar discos en vivo. */
export function hayClaveIA(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.DEEPSEEK_API_KEY,
  );
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
  // El contexto compartido va PRIMERO y en su propio mensaje: OpenAI cachea
  // solo el prefijo idéntico, y las instrucciones cambian de una llamada a otra.
  const messages = [
    ...(opts.contextoCompartido
      ? [{ role: "system", content: opts.contextoCompartido }]
      : []),
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
  // Con contexto compartido, el system va en bloques: primero el contexto
  // (marcado para caché; el prefijo cacheado es todo lo que va antes de la
  // marca, así que tiene que ser lo primero) y después las instrucciones.
  const system = opts.contextoCompartido
    ? [
        {
          type: "text",
          text: opts.contextoCompartido,
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: opts.system },
      ]
    : opts.system;
  const cuerpo = JSON.stringify({
    model,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.7,
    system,
    messages: [{ role: "user", content: opts.user }],
  });

  let res: Response | null = null;
  // Un reintento si Anthropic está saturado (429/529): pasa a menudo unos
  // segundos y no merece caer al modelo de respaldo por eso.
  for (let intento = 0; intento < 2; intento++) {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: cuerpo,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
    });
    if ((res.status === 429 || res.status === 529) && intento === 0) {
      await new Promise((r) => setTimeout(r, 2500));
      continue;
    }
    break;
  }
  if (!res || !res.ok) {
    throw new Error(
      `Anthropic ${res?.status ?? "?"}: ${res ? (await res.text()).slice(0, 300) : "sin respuesta"}`,
    );
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

/**
 * DeepSeek: mismo dialecto que OpenAI (mismo cuerpo, misma forma de respuesta),
 * otra URL y otra clave. `deepseek-reasoner` razona antes de contestar y, como
 * los modelos de razonamiento de OpenAI, no acepta `temperature`: se omite para
 * ese modelo en vez de comerse un 400.
 */
async function callDeepSeek(opts: LlmOptions, model: string): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("Falta DEEPSEEK_API_KEY en .env");
  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
  const esRazonador = model.toLowerCase().includes("reasoner");
  const messages = [
    ...(opts.contextoCompartido
      ? [{ role: "system", content: opts.contextoCompartido }]
      : []),
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];

  // Reintento ante saturación (503/429): DeepSeek también rate-limita.
  for (let intento = 0; ; intento++) {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        // Con el razonador el tope cuenta también el razonamiento: colchón.
        max_tokens: (opts.maxTokens ?? 4096) + (esRazonador ? 2000 : 0),
        ...(esRazonador ? {} : { temperature: opts.temperature ?? 0.7 }),
        messages,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
    });
    if ((res.status === 429 || res.status === 503) && intento < 2) {
      await new Promise((r) => setTimeout(r, 2000 * (intento + 1)));
      continue;
    }
    if (!res.ok) {
      throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      choices: { message: { content: string | null }; finish_reason?: string }[];
    };
    const contenido = data.choices?.[0]?.message?.content ?? "";
    if (!contenido.trim()) {
      const razon = data.choices?.[0]?.finish_reason ?? "desconocida";
      throw new Error(
        `DeepSeek ${model} devolvió una respuesta vacía (finish_reason: ${razon})` +
          `${razon === "length" ? " — se quedó sin tope de tokens" : ""}`,
      );
    }
    return contenido;
  }
}

async function callLlm(
  opts: LlmOptions,
  model: string,
  provider: Proveedor = getProvider(),
): Promise<string> {
  if (provider === "openai") return callOpenAI(opts, model);
  if (provider === "deepseek") return callDeepSeek(opts, model);
  return callAnthropic(opts, model);
}

// ─── La pluma: el modelo que ESCRIBE las historias ──────────────────────────
//
// Las historias de los discos se escriben una sola vez y las leen todos los
// oyentes para siempre, así que es el único sitio donde de verdad compensa
// pagar por prosa. Con gpt-4o-mini salían todas cortadas por el mismo molde
// ("Imagina un estudio en 1970, donde el aire está cargado de electricidad…").
//
// Por eso la pluma va APARTE del resto: el runtime (elegir, verificar pedidos,
// chat) y la generación (proponer discos, caminos, atlas) siguen con su modelo,
// y solo la redacción del dossier usa un modelo mejor.
//
// Variables (todas opcionales):
//   DOSSIER_MODEL    modelo de la pluma (p. ej. deepseek-chat, claude-sonnet-4-6).
//   DOSSIER_PROVIDER openai | anthropic | deepseek, por si el nombre no lo deja claro.
//
// Orden si no dices nada: DeepSeek (si hay DEEPSEEK_API_KEY) → Claude (si hay
// ANTHROPIC_API_KEY) → el modelo de generación de siempre. DeepSeek va primero
// porque es el que está pagando el dueño y cuesta una fracción de Claude.

function proveedorDeModelo(model: string): Proveedor | null {
  const m = model.toLowerCase();
  if (m.startsWith("claude")) return "anthropic";
  if (m.startsWith("deepseek")) return "deepseek";
  if (m.startsWith("gpt") || /^o\d/.test(m) || m.startsWith("openai/")) return "openai";
  return null;
}

function plumaElegida(): { model: string; provider: Proveedor } {
  const explicito = process.env.DOSSIER_PROVIDER?.toLowerCase();
  const providerExplicito =
    explicito === "openai" || explicito === "anthropic" || explicito === "deepseek"
      ? (explicito as Proveedor)
      : undefined;

  const model = process.env.DOSSIER_MODEL?.trim();
  if (model) {
    return { model, provider: providerExplicito ?? proveedorDeModelo(model) ?? getProvider() };
  }
  if (providerExplicito) {
    return { model: modeloPorDefecto(providerExplicito), provider: providerExplicito };
  }
  if (process.env.DEEPSEEK_API_KEY) return { model: "deepseek-chat", provider: "deepseek" };
  if (process.env.ANTHROPIC_API_KEY) return { model: "claude-sonnet-4-6", provider: "anthropic" };
  return { model: generationModel(), provider: getProvider() };
}

/** Nombre del modelo que escribe las historias (para el panel del dueño). */
export function plumaModelName(): string {
  try {
    return plumaElegida().model;
  } catch {
    return "—";
  }
}

/**
 * Redacción y verificación del dossier con la pluma.
 *
 * Si la pluma falla (Anthropic caído, clave mal puesta, saldo agotado) se
 * reintenta UNA vez con el modelo de generación de siempre: una historia algo
 * más plana es mejor que un oyente sin disco (regla 4 del CLAUDE.md). El panel
 * de /revision sí prueba la pluma sin red (`sinRespaldo`) para que el fallo se
 * vea en vez de quedar tapado.
 */
export async function llmRedaccion(
  opts: LlmOptions & { sinRespaldo?: boolean },
): Promise<string> {
  const pluma = plumaElegida();
  try {
    return await callLlm(opts, opts.model ?? pluma.model, pluma.provider);
  } catch (err) {
    if (opts.sinRespaldo) throw err;
    // Respaldo 1: el modelo de generación del mismo proveedor (más barato).
    const proveedorBase = getProvider();
    const modeloBase = modeloCompat(opts.model, proveedorBase) ?? generationModel();
    try {
      console.warn(
        `[llm] la pluma ${pluma.model} falló (${(err as Error).message.slice(0, 160)}); ` +
          `escribo con ${modeloBase}.`,
      );
      return await callLlm(opts, modeloBase, proveedorBase);
    } catch {
      // Respaldo 2: otro proveedor con clave (una clave sin saldo no puede
      // dejar un disco sin historia).
      return llamarConRespaldo(opts, modeloBase, proveedorBase);
    }
  }
}

/**
 * Todos los proveedores con clave configurada, en orden de preferencia. Sirve
 * para el respaldo: una clave sin saldo (o vencida) no puede dejar la app sin
 * discos cuando hay otra disponible.
 */
export function proveedoresDisponibles(): Proveedor[] {
  const out: Proveedor[] = [];
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicit === "openai" || explicit === "anthropic" || explicit === "deepseek") {
    out.push(explicit);
  }
  // DeepSeek antes que Claude: es el que el dueño paga y el más barato.
  if (process.env.DEEPSEEK_API_KEY) out.push("deepseek");
  if (process.env.ANTHROPIC_API_KEY) out.push("anthropic");
  if (process.env.OPENAI_API_KEY) out.push("openai");
  return [...new Set(out)];
}

/**
 * Una llamada con red de seguridad: si el proveedor configurado falla (clave sin
 * saldo, 401, 429, caído), se prueba UNA vez con cada otro proveedor que tenga
 * clave. Es lo que evita que una clave muerta deje la app en «creando tu disco»
 * para siempre — que es exactamente lo que pasó cuando se acabó el saldo de
 * Claude y el runtime seguía apuntando allí.
 */
async function llamarConRespaldo(
  opts: LlmOptions,
  model: string,
  principal: Proveedor,
): Promise<string> {
  try {
    return await callLlm(opts, model, principal);
  } catch (err) {
    const otros = proveedoresDisponibles().filter((p) => p !== principal);
    for (const p of otros) {
      try {
        const modelo = modeloCompat(opts.model, p) ?? modeloPorDefecto(p);
        console.warn(
          `[llm] ${principal} falló (${(err as Error).message.slice(0, 120)}); ` +
            `reintento con ${p} (${modelo}).`,
        );
        return await callLlm(opts, modelo, p);
      } catch {
        // probamos con el siguiente
      }
    }
    throw err;
  }
}

/** Runtime: recomendaciones, chat, curiosidades del día (modelo barato). */
export async function llm(opts: LlmOptions): Promise<string> {
  const provider = getProvider();
  return llamarConRespaldo(opts, modeloCompat(opts.model, provider) ?? runtimeModel(), provider);
}

/** Pipeline de dossier: propuestas, caminos, atlas, social. */
export async function llmGeneration(opts: LlmOptions): Promise<string> {
  const provider = getProvider();
  return llamarConRespaldo(
    opts,
    modeloCompat(opts.model, provider) ?? generationModel(),
    provider,
  );
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
