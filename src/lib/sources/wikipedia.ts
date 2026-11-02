// Wikipedia (es con fallback a en): intro + secciones profundas (Fase 6.9).

export type WikiExtract = { title: string; text: string; url: string; lang: string };

export type WikiSectionPassage = {
  title: string;
  text: string;
  source: string;
  url: string;
  lang: string;
};

const DEEP_SECTION =
  /recep|cr[ií]tic|legado|legacy|influenc|controvers|pol[eé]mic|en vivo|live|tour|grab|record|product|historia|history|premio|award|chart|lista|ranking|impact|legacy|aftermath|background|concert|performance|rival|feud|colabor|collabor|compos|lyric|letra|music|m[uú]sica|songs|artwork|portada|cover|release|lanzamiento|writing|escritura|concept|theme|antecedente|contexto|origin/i;

// Secciones que el filtro de arriba dejaría pasar pero que no cuentan nada:
// listas de canciones, créditos, referencias. Gastan contexto y no dan historia.
const SECCION_INUTIL =
  /track ?list|lista de (canciones|temas)|listado|personnel|^personal$|^m[uú]sicos$|cr[eé]ditos|credits|references|referencias|^notes|^notas|external links|enlaces externos|bibliograf|see also|v[eé]ase/i;

const MAX_SECTION_CHARS = 4_000;
const INTRO_CHARS = 6_000;

// Wikimedia exige que cada cliente se identifique con un User-Agent propio. Sin
// él, en cuanto pedíamos disco y artista a la vez (diez o doce peticiones
// seguidas), empezaba a devolver 429 y las secciones llegaban vacías EN
// SILENCIO: el dossier se escribía con medio contexto y nadie se enteraba.
const WIKI_HEADERS = {
  "User-Agent": "Musicart/1.0 (https://musicart-three.vercel.app; curaduria musical)",
  "Api-User-Agent": "Musicart/1.0 (https://musicart-three.vercel.app)",
};

/** fetch para Wikipedia: se identifica y reintenta una vez si nos frenan. */
async function fetchWiki(url: string, init: { signal?: AbortSignal } = {}): Promise<Response> {
  for (let intento = 0; ; intento++) {
    const res = await fetch(url, { ...init, headers: WIKI_HEADERS });
    if ((res.status === 429 || res.status === 503) && intento < 2) {
      await new Promise((r) => setTimeout(r, 800 * (intento + 1)));
      continue;
    }
    return res;
  }
}

async function wikiSearch(
  lang: "es" | "en",
  query: string,
): Promise<string | null> {
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  const searchRes = await fetchWiki(
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
  return (
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      // Fuera la tramoya de Wikipedia, que el redactor leía como texto: el
      // título de la sección, los enlaces "[editar]", los avisos de "faltan
      // citas" y las tablas (puntuaciones de reseñas sin contexto, listas).
      .replace(/<h[1-6][\s\S]*?<\/h[1-6]>/gi, " ")
      .replace(/<span[^>]*mw-editsection[\s\S]*?<\/span>\s*<\/span>/gi, " ")
      .replace(/<table[\s\S]*?<\/table>/gi, " ")
      .replace(/<sup[^>]*class="[^"]*reference[\s\S]*?<\/sup>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      // Lo que se haya colado: marcas de nota [1], [a], [cita requerida]…
      .replace(/\[\s*(\d+|[a-z]|edit(ar)?(\s*\|\s*edit(ar)? (source|código))?|cita requerida|citation needed|nota \d+)\s*\]/gi, "")
      .replace(/This section needs (additional|more) citations[^.]*\.[^.]*\./gi, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

async function getIntroExtract(lang: "es" | "en", title: string): Promise<string | null> {
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  const extractRes = await fetchWiki(
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
  const res = await fetchWiki(
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
  const res = await fetchWiki(
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
  max = 5,
): Promise<WikiSectionPassage[]> {
  const sections = await getWikiSections(lang, title);
  const out: WikiSectionPassage[] = [];
  const url = wikiUrl(lang, title);

  for (const sec of sections) {
    if (sec.index === "0") continue;
    const heading = sec.line.replace(/<[^>]+>/g, "").trim();
    if (!heading || !DEEP_SECTION.test(heading) || SECCION_INUTIL.test(heading)) continue;
    if (out.length >= max) break;

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

/**
 * Solo la entrada del artículo del artista, sin las secciones profundas.
 *
 * Existe aparte de `getArtistContext` porque la barrera del origen (7.9) la
 * llama en caliente, mientras el oyente espera su disco: ahí no se pueden pagar
 * las cinco o seis peticiones que cuesta traer "Recepción", "Legado" y compañía
 * para leer una sola frase. Esto son dos o tres, y con eso basta — la
 * nacionalidad de un artista vive SIEMPRE en la primera frase del artículo.
 */
export async function getArtistIntro(artist: string): Promise<WikiExtract | null> {
  let article: { title: string; lang: "es" | "en" } | null = null;
  for (const q of [artist, `${artist} musician`]) {
    article = (await resolveArticle("es", q)) ?? (await resolveArticle("en", q));
    if (article) break;
  }
  if (!article) return null;

  const text = await getIntroExtract(article.lang, article.title);
  if (!text) return null;
  return {
    title: article.title,
    text,
    url: wikiUrl(article.lang, article.title),
    lang: article.lang,
  };
}

export async function getArtistContext(artist: string): Promise<WikiExtract | null> {
  const { intro } = await buildWikiContext([artist, `${artist} musician`]);
  return intro;
}

// ─── Contexto BILINGÜE (para escribir historias con detalle) ────────────────
//
// buildWikiContext se queda con la PRIMERA Wikipedia que encuentra, y busca
// primero en español. Para la gran mayoría de los discos el artículo en inglés
// es varias veces más rico: tiene "Background", "Recording", "Composition",
// "Release", "Reception", "Legacy"… y el español apenas un párrafo. Con eso el
// redactor no tenía de dónde sacar escenas y rellenaba con frases de molde.
//
// Aquí se piden las dos a la vez y se usan las dos (el redactor escribe en
// español igual: la fuente en inglés solo aporta hechos). Y se comprueba que el
// artículo sea el del disco o el del artista — la búsqueda de "Paranoid" puede
// devolver la canción, y un hecho de la canción contado como del disco es justo
// el tipo de error que el verificador no ve.

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿El título del artículo se refiere a lo que buscamos? */
function articuloEncaja(tituloArticulo: string, buscado: string, tipo: "album" | "artista"): boolean {
  const t = normalizar(tituloArticulo);
  const b = normalizar(buscado);
  if (!t || !b) return false;
  if (!(t.includes(b) || b.includes(t))) return false;
  // Si es el artículo de una canción o de una película homónima, no nos sirve.
  const desambiguacion = tituloArticulo.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() ?? "";
  if (tipo === "album" && /song|canci[oó]n|single|sencillo|film|pel[ií]cula|novel|novela/.test(desambiguacion)) {
    return false;
  }
  // Una banda con disco homónimo («Black Sabbath») devolvía el artículo DEL
  // DISCO como si fuera el del artista.
  if (tipo === "artista" && /album|álbum|song|canci[oó]n|single|sencillo|film|pel[ií]cula|tv|serie|novel/.test(desambiguacion)) {
    return false;
  }
  return true;
}

async function resolverEncajado(
  lang: "es" | "en",
  queries: string[],
  buscado: string,
  tipo: "album" | "artista",
): Promise<string | null> {
  for (const q of queries) {
    const api = `https://${lang}.wikipedia.org/w/api.php`;
    const res = await fetchWiki(
      `${api}?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=5&format=json&origin=*`,
      { signal: AbortSignal.timeout(10_000) },
    ).catch(() => null);
    if (!res?.ok) continue;
    const data = (await res.json().catch(() => null)) as {
      query?: { search?: { title: string }[] };
    } | null;
    const titulos = (data?.query?.search ?? []).map((s) => s.title);
    // Preferimos el que lleva "(álbum)"/"(album)" en el título si existe.
    const preferido =
      titulos.find((t) => articuloEncaja(t, buscado, tipo) && /\((?:[^)]*\s)?(?:álbum|album)\)/i.test(t)) ??
      titulos.find((t) => articuloEncaja(t, buscado, tipo));
    if (preferido) return preferido;
  }
  return null;
}

async function contextoDeIdioma(
  lang: "es" | "en",
  queries: string[],
  buscado: string,
  tipo: "album" | "artista",
  maxSecciones: number,
  debeMencionar?: string,
): Promise<{ intro: WikiExtract | null; sections: WikiSectionPassage[] }> {
  const title = await resolverEncajado(lang, queries, buscado, tipo).catch(() => null);
  if (!title) return { intro: null, sections: [] };
  const [introText, sections] = await Promise.all([
    getIntroExtract(lang, title).catch(() => null),
    gatherDeepPassages(lang, title, maxSecciones).catch(() => []),
  ]);
  // El artículo de un disco nombra a su artista en la entrada. Si no lo hace,
  // es otro "Bad" u otro "Thriller": mejor sin contexto que con el ajeno.
  if (debeMencionar && introText && !normalizar(introText).includes(normalizar(debeMencionar))) {
    return { intro: null, sections: [] };
  }
  return {
    intro: introText ? { title, text: introText, url: wikiUrl(lang, title), lang } : null,
    sections,
  };
}

export type ContextoBilingue = {
  intros: WikiExtract[];
  sections: WikiSectionPassage[];
};

/** Álbum: intro + secciones en español E inglés, solo si el artículo encaja. */
export async function getAlbumContextoBilingue(
  album: string,
  artist: string,
): Promise<ContextoBilingue> {
  const [es, en] = await Promise.all([
    contextoDeIdioma("es", [`${album} álbum ${artist}`, `${album} ${artist}`], album, "album", 3, artist),
    contextoDeIdioma("en", [`${album} album ${artist}`, `${album} ${artist}`], album, "album", 7, artist),
  ]);
  return {
    intros: [es.intro, en.intro].filter((x): x is WikiExtract => Boolean(x)),
    sections: [...en.sections, ...es.sections],
  };
}

/** Artista: intro + secciones en español E inglés, solo si el artículo encaja. */
export async function getArtistContextoBilingue(artist: string): Promise<ContextoBilingue> {
  const [es, en] = await Promise.all([
    contextoDeIdioma("es", [artist, `${artist} músico`, `${artist} banda`], artist, "artista", 2),
    contextoDeIdioma("en", [artist, `${artist} band`, `${artist} musician`], artist, "artista", 4),
  ]);
  return {
    intros: [es.intro, en.intro].filter((x): x is WikiExtract => Boolean(x)),
    sections: [...en.sections, ...es.sections],
  };
}

/** Intro + secciones del artista (rivalidades, carrera, premios…). */
export async function getArtistDeepContext(
  artist: string,
): Promise<{ intro: WikiExtract | null; sections: WikiSectionPassage[] }> {
  return buildWikiContext([artist, `${artist} musician`]).then(
    ({ intro, deepSections }) => ({ intro, sections: deepSections }),
  );
}
