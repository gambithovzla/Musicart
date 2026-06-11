// TTS (Fase 4.1): síntesis de voz vía OpenAI Audio API.
// Usa OPENAI_API_KEY o TTS_API_KEY. Voz por defecto: nova (clara en español).

const TTS_URL = "https://api.openai.com/v1/audio/speech";
const MAX_CHARS = 4096;

function apiKey(): string {
  const key = (process.env.TTS_API_KEY || process.env.OPENAI_API_KEY)?.trim();
  if (!key) {
    throw new Error(
      "Falta OPENAI_API_KEY o TTS_API_KEY en .env para generar audio.",
    );
  }
  return key;
}

/** Trocea texto largo en fragmentos seguros para la API. */
export function chunkForTts(text: string, max = MAX_CHARS): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= max) return [trimmed];

  const chunks: string[] = [];
  let rest = trimmed;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(". ", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(" ", max);
    if (cut < max * 0.3) cut = max;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const parts = chunkForTts(text);
  const buffers: Buffer[] = [];
  for (const part of parts) {
    buffers.push(await synthesizeChunk(part));
  }
  return Buffer.concat(buffers);
}

async function synthesizeChunk(text: string): Promise<Buffer> {
  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.TTS_MODEL ?? "tts-1-hd",
      voice: process.env.TTS_VOICE ?? "nova",
      input: text,
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) {
    throw new Error(`OpenAI TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
