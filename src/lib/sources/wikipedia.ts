// Wikipedia (es con fallback a en): intro + secciones profundas (Fase 6.9).

type WikiExtract = { title: string; text: string; url: string; lang: string };

export type WikiSectionPassage = {
  title: string;
  text: string;
  source: string;
  url: string;
  lang: string;
};

const DEEP_SECTION =
  /recep|cr[ií]tic|legado|legacy|influenc|controvers|pol[eé]mic|en vivo|live|tour|grab|record|product|historia|history|premio|award|chart|lista|ranking|impact|legacy|aftermath|background|concert|performance|rival|feud|colabor|collabor/i;

const MAX_SECTION_CHARS = 4_000;
const INTRO_CHARS = 6_000;

async function wikiSearch(
  lang: "es" | "en",
  query: string,
): Promise<string | null> {
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  const searchRes = await fetch(
    `${api}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!searchRes.ok) return null;
  const search = (await searchRes.json()) as {
    query?: { search?: { title: string }[] };
  };
  return search.query?.search?.[0]?.title ?? null;
}

function wikiUrl(lang: string, title: string): string {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function getIntroExtract(lang: "es" | "en", title: string): Promise<string | null> {
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  const extractRes = await fetch(
    `${api}?action=query&prop=extracts&explaintext=1&exsectionformat=plain&titles=${encodeURIComponent(title)}&format=json&origin=*&exchars=${INTRO_CHARS}`,
    { signal: AbortSignal.timeout(12_000) },
  );
  if (!extractRes.ok) return null;
  const data = (await extractRes.json()) as {
    query?: { pages?: Record<string, { extract?: string }> };
  };
  const text = Object.values(data.query?.pages ?? {})[0]?.extract?.trim();
  return text || null;
}

async function getWikiSections(
  lang: "es" | "en",
  title: string,
): Promise<{ index: string; line: string; anchor: string }[]> {
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  const res = await fetch(
    `${api}?action=parse&page=${encodeURIComponent(title)}&prop=sections&format=json&origin=*`,
    { signal: AbortSignal.timeout(12_000) },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    parse?: { sections?: { index: string; line: string; anchor: string }[] };
  };
  return data.parse?.sections ?? [];
}

async function getSectionText(
  lang: "es" | "en",
  title: string,
  sectionIndex: string,
): Promise<string | null> {
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  const res = await fetch(
    `${api}?action=parse&page=${encodeURIComponent(title)}&section=${sectionIndex}&prop=text&format=json&origin=*`,
    { signal: AbortSignal.timeout(12_000) },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    parse?: { text?: { "*"?: string } };
  };
  const html = data.parse?.text?.["*"];
  if (!html) return null;
  const text = stripHtml(html);
  return text.length > 80 ? text.slice(0, MAX_SECTION_CHARS) : null;
}

/** Primera oración sustantiva (para facts[] con cita). */
export function firstFactSentence(text: string, maxLen = 280): string | null {
  const cleaned = text.replace(/\[\d+\]/g, "").trim();
  const match = cleaned.match(/[^.!?]+[.!?]+/);
  const sentence = (match?.[0] ?? cleaned.slice(0, maxLen)).trim();
  if (sentence.length < 40) return null;
  return sentence.length > maxLen ? `${sentence.slice(0, maxLen - 1)}…` : sentence;
}

async function gatherDeepPassages(
  lang: "es" | "en",
  title: string,
): Promise<WikiSectionPassage[]> {
  const sections = await getWikiSections(lang, title);
  const out: WikiSectionPassage[] = [];
  const url = wikiUrl(lang, title);

  for (const sec of sections) {
    if (sec.index === "0") continue;
    const heading = sec.line.replace(/<[^>]+>/g, "").trim();
    if (!heading || !DEEP_SECTION.test(heading)) continue;
    if (out.length >= 5) break;

    const text = await getSectionText(lang, title, sec.index);
    if (!text) continue;

    out.push({
      title: heading,
      text,
      source: `wikipedia:${lang}:sección:${heading}`,
      url,
      lang,
    });
  }

  return out;
}

async function resolveArticle(
  lang: "es" | "en",
  query: string,
): Promise<{ title: string; lang: "es" | "en" } | null> {
  const title = await wikiSearch(lang, query);
  return title ? { title, lang } : null;
}

async function buildWikiContext(
  queries: string[],
): Promise<{
  intro: WikiExtract | null;
  deepSections: WikiSectionPassage[];
}> {
  let article: { title: string; lang: "es" | "en" } | null = null;
  for (const q of queries) {
    article =
      (await resolveArticle("es", q)) ?? (await resolveArticle("en", q));
    if (article) break;
  }
  if (!article) return { intro: null, deepSections: [] };

  const [introText, deepSections] = await Promise.all([
    getIntroExtract(article.lang, article.title),
    gatherDeepPassages(article.lang, article.title),
  ]);

  const intro = introText
    ? {
        title: article.title,
        text: introText,
        url: wikiUrl(article.lang, article.title),
        lang: article.lang,
      }
    : null;

  return { intro, deepSections };
}

// Busca el artículo del álbum: intro + secciones profundas.
export async function getAlbumContext(
  album: string,
  artist: string,
): Promise<WikiExtract | null> {
  const { intro } = await buildWikiContext([
    `${album} álbum ${artist}`,
    `${album} album ${artist}`,
  ]);
  return intro;
}

/** Intro + secciones profundas del artículo del álbum (Recepción, Legado…). */
export async function getAlbumDeepContext(
  album: string,
  artist: string,
): Promise<{ intro: WikiExtract | null; sections: WikiSectionPassage[] }> {
  return buildWikiContext([`${album} álbum ${artist}`, `${album} album ${artist}`]).then(
    ({ intro, deepSections }) => ({ intro, sections: deepSections }),
  );
}

export async function getArtistContext(artist: string): Promise<WikiExtract | null> {
  const { intro } = await buildWikiContext([artist, `${artist} musician`]);
  return intro;
}

/** Intro + secciones del artista (rivalidades, carrera, premios…). */
export async function getArtistDeepContext(
  artist: string,
): Promise<{ intro: WikiExtract | null; sections: WikiSectionPassage[] }> {
  return buildWikiContext([artist, `${artist} musician`]).then(
    ({ intro, deepSections }) => ({ intro, sections: deepSections }),
  );
}
