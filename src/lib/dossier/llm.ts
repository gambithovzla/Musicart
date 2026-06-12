// Adapter de LLM intercambiable: OpenAI o Anthropic vía variables de entorno.
// LLM_PROVIDER=openai|anthropic · LLM_MODEL (runtime barato) ·
// GENERATION_MODEL (solo dossier: generate + verify, Fase 6.8)

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

/** ¿Hay una clave de IA configurada? Para decidir si podemos fabricar discos en vivo. */
export function hayClaveIA(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

async function callOpenAI(opts: LlmOptions, model: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Falta OPENAI_API_KEY en .env");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 4096,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
  });
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message.content ?? "";
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
  };
  return data.content.find((b) => b.type === "text")?.text ?? "";
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
