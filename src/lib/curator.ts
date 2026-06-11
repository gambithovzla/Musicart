// Curador IA (Fase 2): decide qué álbumes debe generar el catálogo a continuación.
// Propone clásicos imprescindibles, huecos del catálogo (géneros, épocas, idiomas)
// y afinidades con lo que los usuarios puntúan alto. Las propuestas se persisten
// en GenerationQueue; el worker (scripts/worker.ts) las genera con el pipeline.

import { prisma } from "./db";
import { llm, extractJson } from "./dossier/llm";

const MAX_PROPOSALS = 10;

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Clave anti-duplicados de la cola: "artista|título" normalizado.
export function queueKey(title: string, artist: string): string {
  return `${normalizar(artist)}|${normalizar(title)}`;
}

/**
 * Mete un álbum a la cola de generación si no está ya en el catálogo ni en la
 * cola. Devuelve true si se encoló.
 */
export async function enqueueAlbum(input: {
  title: string;
  artist: string;
  reason?: string;
  source?: "curator" | "jump" | "manual";
  priority?: number;
}): Promise<boolean> {
  const title = input.title.trim();
  const artist = input.artist.trim();
  if (!title || !artist) return false;
  const key = queueKey(title, artist);

  const albums = await prisma.album.findMany({
    select: { title: true, artist: { select: { name: true } } },
  });
  const yaEnCatalogo = albums.some(
    (a) => queueKey(a.title, a.artist.name) === key,
  );
  if (yaEnCatalogo) return false;

  const yaEnCola = await prisma.generationQueue.findUnique({ where: { key } });
  if (yaEnCola) return false;

  await prisma.generationQueue.create({
    data: {
      key,
      title,
      artist,
      reason: input.reason?.slice(0, 500) ?? null,
      source: input.source ?? "manual",
      priority: Math.min(100, Math.max(1, Math.round(input.priority ?? 100))),
    },
  });
  return true;
}

/**
 * El curador propone los próximos álbumes a generar y los encola.
 * Devuelve cuántos se encolaron (los duplicados se descartan en silencio).
 * Pensado para el worker: si el LLM falla, el error sube y queda registrado.
 */
export async function proposeNextAlbums(
  count = 5,
  log: (msg: string) => void = () => {},
): Promise<number> {
  const cuantos = Math.min(MAX_PROPOSALS, Math.max(1, count));

  const [albums, cola, resenas] = await Promise.all([
    prisma.album.findMany({
      select: { title: true, year: true, artist: { select: { name: true } } },
      orderBy: { year: "asc" },
    }),
    prisma.generationQueue.findMany({
      select: { title: true, artist: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.review.findMany({
      where: { rating: { gte: 4 } },
      include: { album: { include: { artist: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const catalogoTexto =
    albums.length > 0
      ? albums
          .map((a) => `- "${a.title}" de ${a.artist.name} (${a.year})`)
          .join("\n")
      : "(catálogo vacío)";

  const colaTexto =
    cola.length > 0
      ? cola.map((q) => `- "${q.title}" de ${q.artist} [${q.status}]`).join("\n")
      : "(cola vacía)";

  const gustosTexto =
    resenas.length > 0
      ? resenas
          .map(
            (r) =>
              `- "${r.album.title}" de ${r.album.artist.name}: ${r.rating}★`,
          )
          .join("\n")
      : "(aún no hay reseñas altas)";

  const system = `Eres el curador jefe de Musicart, una app en español que cuenta la historia de un álbum al día.
Tu trabajo: decidir qué álbumes generar a continuación para que el catálogo crezca con criterio.

Criterios, en este orden:
1. Clásicos imprescindibles del canon que aún falten (los discos que todo melómano debería conocer).
2. Diversidad: géneros, épocas, países e idiomas variados — incluye música en español (rock latino, salsa, flamenco, etc.), no solo canon anglosajón.
3. Afinidades: si los usuarios puntúan alto ciertos discos, propone vecinos musicales con conexión real.

Reglas:
- NO propongas álbumes que ya están en el catálogo ni en la cola.
- Álbumes reales y verificables (existen en MusicBrainz/Wikipedia). Nada oscuro al punto de no tener documentación.
- "priority": 1 (urgentísimo) a 100; los imprescindibles van bajos.
- "reason": 1 frase en español explicando por qué ese disco ahora.

Responde SOLO un objeto JSON:
{"proposals": [{"title": "...", "artist": "...", "reason": "...", "priority": 30}]}`;

  const user = `CATÁLOGO ACTUAL:
${catalogoTexto}

YA EN COLA (no repetir):
${colaTexto}

LO QUE LOS USUARIOS PUNTÚAN ALTO:
${gustosTexto}

Propón exactamente ${cuantos} álbumes. Responde el JSON ahora.`;

  const raw = await llm({ system, user, temperature: 0.7, maxTokens: 1500 });
  const parsed = extractJson<{
    proposals?: { title?: string; artist?: string; reason?: string; priority?: number }[];
  }>(raw);

  let encolados = 0;
  for (const p of parsed.proposals ?? []) {
    if (!p.title || !p.artist) continue;
    const ok = await enqueueAlbum({
      title: p.title,
      artist: p.artist,
      reason: p.reason,
      source: "curator",
      priority: p.priority,
    });
    if (ok) {
      encolados++;
      log(`Encolado: "${p.title}" de ${p.artist} (prioridad ${p.priority ?? 100})`);
    }
  }
  log(`Curador: ${encolados} álbumes nuevos en la cola.`);
  return encolados;
}
