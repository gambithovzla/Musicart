import { prisma } from "@/lib/db";
import { extractJson, hayClaveIA, llmGeneration } from "@/lib/dossier/llm";
import { parseJson, type FactsPayload } from "@/lib/types";
import {
  socialPlanSchema,
  type SocialPlan,
  type SocialVerification,
} from "./types";

const SYSTEM = `Eres el editor de video vertical de Musicart, una publicación musical con estética de imprenta.

Escribe UN guion en español latinoamericano para un video de 25 a 40 segundos. El FACTS PAYLOAD y el DOSSIER VERIFICADO son tus únicas fuentes. No inventes fechas, nombres, grabaciones, premios, cifras, relaciones ni anécdotas. Puedes condensar y parafrasear, pero nunca añadir hechos.

La voz debe sonar como un melómano que acaba de descubrir algo extraordinario: precisa, cálida y sin frases genéricas de influencer. No uses emojis. No incluyas audio comercial ni instrucciones de descargar música.

EL GANCHO DECIDE TODO (los primeros 3 segundos en TikTok):
- Abre con UN dato concreto y raro de ESTE disco, sacado de las fuentes: un nombre, un lugar, una cifra, una fecha, un conflicto, una decisión. Empieza a mitad de la escena.
- Prueba de sustitución: si el gancho serviría para otro disco cambiando el título, está mal. Reescríbelo.
- PROHIBIDO abrir con: «¿Sabías que…?», «En este video…», «Imagina…», «Hay discos que…», «¿Alguna vez…?», «Este álbum cambió…», ni con preguntas retóricas o generalidades («un álbum puede cambiar una carrera», «la música tiene el poder de…»).
- El gancho se lee en pantalla en la escena 0: máximo 12 palabras, sin dos comas.
- Cierra con el dato que reordena lo anterior, en una línea seca. Sin moraleja, sin «¿y tú qué opinas?». Un solo llamado a la acción, como mucho.
- Las CURIOSIDADES VERIFICADAS del dossier suelen ser el mejor material para el gancho.

Devuelve SOLO JSON con esta forma:
{
  "hook": "...",
  "script": "texto completo que se narrará, 65 a 90 palabras",
  "caption": "caption listo para publicar, con 2 a 4 hashtags al final",
  "durationSec": 30,
  "scenes": [
    {"startSec":0,"endSec":4,"kind":"hook","headline":"...","body":"","sourceRefs":["album"]}
  ]
}

Usa de 4 a 6 escenas contiguas que empiecen en 0 y terminen en durationSec. kind solo puede ser hook, album, context, payoff o cta. sourceRefs señala album, facts[n], passages[n], intro, artistStory, whyItMatters o trackNotes[n].`;

const VERIFY_SYSTEM = `Eres el verificador final de un guion de Musicart.

Tu único objeto de revisión es el texto encerrado en <TARGET>. El FACTS PAYLOAD y el DOSSIER VERIFICADO, encerrados en <SOURCES>, son fuentes de respaldo: nunca los revises ni devuelvas afirmaciones tomadas de ellos.

Busca en <TARGET> afirmaciones factuales concretas que no estén respaldadas por <SOURCES>. No marques opiniones, descripciones estéticas, interpretaciones emocionales ni invitaciones a escuchar.

Cada elemento de "unsupported" debe ser una cita textual exacta y completa copiada de <TARGET>. No parafrasees, no expliques y no menciones hechos que solo aparezcan en <SOURCES>. Si no puedes copiar la afirmación literalmente de <TARGET>, no la incluyas.

Responde SOLO JSON: {"unsupported":["cita textual exacta del TARGET"]}.`;

const REPAIR_SYSTEM = `Eres el editor de cierre de Musicart. Recibirás una pieza social en JSON y las observaciones exactas del verificador.

Corrige la pieza eliminando o reescribiendo únicamente las afirmaciones señaladas. Usa solo el FACTS PAYLOAD y el DOSSIER VERIFICADO. Si una afirmación es ambigua, elimínala: nunca intentes defenderla ni sustituirla por otro dato no respaldado.

Conserva el tono, la duración, la estructura JSON y entre 4 y 6 escenas contiguas. Devuelve SOLO el JSON completo corregido, con la misma forma de la pieza original.`;

type LoadedDossier = NonNullable<Awaited<ReturnType<typeof loadDossier>>>;

async function loadDossier(dossierId: string) {
  return prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      album: { include: { artist: true } },
      trackNotes: { orderBy: { position: "asc" } },
    },
  });
}

function words(text: string, max: number): string {
  return text.trim().split(/\s+/).slice(0, max).join(" ").replace(/[,;:]?$/, ".");
}

// Aperturas de molde: valen para cualquier disco, y en TikTok el que pasa el
// dedo ya las vio mil veces. Si una nueva se repite, se añade aquí y solo aquí.
const GANCHOS_DE_MOLDE: { re: RegExp; porque: string }[] = [
  { re: /^\s*¿?\s*sab[ií]as que/i, porque: "abre con «¿Sabías que…?»" },
  { re: /^\s*(en este video|hoy te cuento|te cuento)/i, porque: "anuncia el video en vez de contarlo" },
  { re: /^\s*imagina/i, porque: "abre con «Imagina…»" },
  { re: /^\s*hay discos que/i, porque: "abre con «Hay discos que…»" },
  { re: /^\s*¿?\s*alguna vez/i, porque: "pregunta retórica" },
  { re: /(puede|pueden) cambiar (la|una) carrera|el poder de la música|cambi[óo] (la historia|todo)/i, porque: "generalidad que vale para cualquier disco" },
];

export function ganchoDeMolde(hook: string): string | null {
  return GANCHOS_DE_MOLDE.find((m) => m.re.test(hook))?.porque ?? null;
}

function fallbackPlan(d: LoadedDossier): SocialPlan {
  const title = d.album.title;
  const artist = d.album.artist.name;
  const narrative = words(`${d.intro} ${d.whyItMatters}`, 78);
  const durationSec = 30;
  // Sin IA, el mejor gancho es una curiosidad ya verificada del dossier.
  const curiosidad = parseJson<string[]>(d.wowFactsJson, []).find((w) => w.trim().length >= 8);
  const limpia = curiosidad?.replace(/^¿?\s*sab[ií]as que\s*/i, "").replace(/[?¿]/g, "").trim();
  const ganchoDeRespaldo = limpia
    ? words(limpia.charAt(0).toUpperCase() + limpia.slice(1), 18).slice(0, 138)
    : `«${title}», de ${artist}: la historia detrás del disco.`;
  return socialPlanSchema.parse({
    hook: ganchoDeRespaldo,
    script: `${title}, de ${artist}. ${narrative} Musicart propone escucharlo completo, en orden, y descubrir qué cambia cuando el álbum se entiende como una obra entera.`,
    caption: `Hoy en Musicart: «${title}», de ${artist}. Un disco para escuchar completo y con contexto. ¿Qué álbum te hizo sentir algo parecido? #Musicart #Discos #DescubrimientoMusical`,
    durationSec,
    scenes: [
      { startSec: 0, endSec: 4, kind: "hook", headline: ganchoDeRespaldo, body: "", sourceRefs: [curiosidad ? "wowFacts" : "album"] },
      { startSec: 4, endSec: 10, kind: "album", headline: title, body: `${artist} · ${d.album.year}`, sourceRefs: ["album"] },
      { startSec: 10, endSec: 20, kind: "context", headline: words(d.intro, 12), body: "", sourceRefs: ["intro"] },
      { startSec: 20, endSec: 26, kind: "payoff", headline: words(d.whyItMatters, 12), body: "", sourceRefs: ["whyItMatters"] },
      { startSec: 26, endSec: 30, kind: "cta", headline: "Un disco al día.", body: "Musicart", sourceRefs: [] },
    ],
  });
}

function hardErrors(plan: SocialPlan, facts: FactsPayload): string[] {
  const corpus = JSON.stringify(facts).toLowerCase();
  const text = `${plan.hook}\n${plan.script}\n${plan.caption}`;
  const errors: string[] = [];
  for (const year of text.match(/\b(19|20)\d{2}\b/g) ?? []) {
    if (!corpus.includes(year)) errors.push(`El año ${year} no está en el facts payload.`);
  }
  for (let i = 0; i < plan.scenes.length; i++) {
    const scene = plan.scenes[i];
    if (scene.endSec <= scene.startSec) errors.push(`La escena ${i + 1} no tiene duración válida.`);
    if (i > 0 && Math.abs(scene.startSec - plan.scenes[i - 1].endSec) > 0.01) {
      errors.push(`Hay un hueco o solapamiento antes de la escena ${i + 1}.`);
    }
  }
  if (plan.scenes[0]?.startSec !== 0) errors.push("La primera escena no empieza en 0.");
  if (plan.scenes.at(-1)?.endSec !== plan.durationSec) errors.push("La última escena no termina con el video.");
  return errors;
}

function comparable(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * El modelo verificador a veces devolvía hechos que había leído en las fuentes,
 * aunque no aparecieran en la pieza social. Una observación solo puede bloquear
 * la publicación si es, como exige el prompt, una cita del texto revisado.
 */
function targetClaimsOnly(claims: unknown[], target: string): string[] {
  const normalizedTarget = comparable(target);
  return claims
    .filter((claim): claim is string => typeof claim === "string")
    .map((claim) => claim.trim())
    .filter(Boolean)
    .filter((claim) => {
      const normalizedClaim = comparable(claim);
      return normalizedClaim.length >= 8 && normalizedTarget.includes(normalizedClaim);
    });
}

async function verify(
  plan: SocialPlan,
  facts: FactsPayload,
  dossierText: string,
  usedFallback: boolean,
): Promise<SocialVerification> {
  const hard = hardErrors(plan, facts);
  if (usedFallback) {
    return { ok: hard.length === 0, hardErrors: hard, unsupportedClaims: [], method: "verified_dossier_fallback" };
  }
  try {
    const target = [
      `HOOK: ${plan.hook}`,
      `GUION: ${plan.script}`,
      `CAPTION: ${plan.caption}`,
    ].join("\n");
    const raw = await llmGeneration({
      system: VERIFY_SYSTEM,
      user: `<SOURCES>\nFACTS PAYLOAD:\n${JSON.stringify(facts)}\n\nDOSSIER VERIFICADO:\n${dossierText}\n</SOURCES>\n\n<TARGET>\n${target}\n</TARGET>`,
      temperature: 0,
      maxTokens: 700,
    });
    const reported = extractJson<{ unsupported?: unknown[] }>(raw).unsupported ?? [];
    const unsupported = targetClaimsOnly(reported, target);
    return { ok: hard.length === 0 && unsupported.length === 0, hardErrors: hard, unsupportedClaims: unsupported, method: "llm_and_code" };
  } catch (error) {
    return {
      ok: false,
      hardErrors: [...hard, `El verificador no respondió: ${(error as Error).message.slice(0, 180)}`],
      unsupportedClaims: [],
      method: "llm_and_code",
    };
  }
}

async function repairPlan(
  plan: SocialPlan,
  facts: FactsPayload,
  dossierText: string,
  verification: SocialVerification,
): Promise<SocialPlan> {
  const observations = [...verification.hardErrors, ...verification.unsupportedClaims];
  const raw = await llmGeneration({
    system: REPAIR_SYSTEM,
    user: `<SOURCES>\nFACTS PAYLOAD:\n${JSON.stringify(facts, null, 2)}\n\nDOSSIER VERIFICADO:\n${dossierText}\n</SOURCES>\n\n<PIEZA>\n${JSON.stringify(plan, null, 2)}\n</PIEZA>\n\n<OBSERVACIONES>\n${observations.map((item) => `- ${item}`).join("\n")}\n</OBSERVACIONES>`,
    temperature: 0.2,
    maxTokens: 1800,
  });
  return socialPlanSchema.parse(extractJson(raw));
}

export async function generateSocialContent(
  dossierId: string,
  opciones: {
    /** Rellena una pieza ya reservada (la pieza del día) en vez de crear otra. */
    contentId?: string;
  } = {},
) {
  const d = await loadDossier(dossierId);
  if (!d || d.status !== "published") throw new Error("El dossier debe estar publicado antes de convertirlo en video.");

  const facts = parseJson<FactsPayload | null>(d.album.factsJson, null);
  if (!facts) throw new Error("Este disco no tiene facts payload verificable.");
  const dossierText = [
    `INTRO: ${d.intro}`,
    `ARTISTA: ${d.artistStory}`,
    `IMPORTANCIA: ${d.whyItMatters}`,
    ...d.trackNotes.map((t, i) => `TRACK ${i}: ${t.title}. ${t.note ?? ""}`),
    ...parseJson<string[]>(d.wowFactsJson, []).map((w, i) => `CURIOSIDAD VERIFICADA ${i}: ${w}`),
  ].join("\n");

  let plan: SocialPlan;
  let usedFallback = false;
  if (hayClaveIA()) {
    try {
      const raw = await llmGeneration({
        system: SYSTEM,
        user: `FACTS PAYLOAD:\n${JSON.stringify(facts, null, 2)}\n\nDOSSIER VERIFICADO:\n${dossierText}`,
        temperature: 0.55,
        maxTokens: 1800,
      });
      plan = socialPlanSchema.parse(extractJson(raw));
      // Barrera del gancho (sin IA): si abre con molde, se pide UNA reescritura
      // diciéndole exactamente qué falló. Si la segunda falla, queda la primera.
      const molde = ganchoDeMolde(plan.hook);
      if (molde) {
        try {
          const otra = await llmGeneration({
            system: SYSTEM,
            user: `FACTS PAYLOAD:\n${JSON.stringify(facts, null, 2)}\n\nDOSSIER VERIFICADO:\n${dossierText}\n\nTU GANCHO ANTERIOR FUE RECHAZADO: «${plan.hook}» (${molde}). Escribe la pieza otra vez abriendo con un dato concreto y exclusivo de este disco.`,
            temperature: 0.6,
            maxTokens: 1800,
          });
          const reescrita = socialPlanSchema.parse(extractJson(otra));
          if (!ganchoDeMolde(reescrita.hook)) plan = reescrita;
        } catch (error) {
          console.warn(`[social] No pude reescribir el gancho: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      console.warn(`[social] El editor IA falló; uso composición segura: ${(error as Error).message}`);
      plan = fallbackPlan(d);
      usedFallback = true;
    }
  } else {
    plan = fallbackPlan(d);
    usedFallback = true;
  }

  let verification = await verify(plan, facts, dossierText, usedFallback);

  // Una frase dudosa no debe obligar al dueño a descartar y volver a crear la
  // pieza a mano. El editor recibe el recibo exacto, corrige una vez y vuelve a
  // pasar por la misma barrera. Si todavía hay dudas, usamos la composición
  // conservadora construida solo con el dossier que ya fue verificado.
  if (!verification.ok && !usedFallback) {
    try {
      plan = await repairPlan(plan, facts, dossierText, verification);
      verification = await verify(plan, facts, dossierText, false);
    } catch (error) {
      console.warn(`[social] La corrección automática falló: ${(error as Error).message}`);
    }

    if (!verification.ok) {
      plan = fallbackPlan(d);
      usedFallback = true;
      verification = await verify(plan, facts, dossierText, usedFallback);
    }
  }

  const data = {
    dossierId: d.id,
    status: verification.ok ? "draft" : "blocked",
    hook: plan.hook,
    script: plan.script,
    caption: plan.caption,
    scenesJson: JSON.stringify({ durationSec: plan.durationSec, scenes: plan.scenes }),
    factsSnapshotJson: JSON.stringify(facts),
    verificationJson: JSON.stringify(verification),
    rightsStatus: "clear",
  };
  if (opciones.contentId) {
    return prisma.socialContent.update({ where: { id: opciones.contentId }, data });
  }
  return prisma.socialContent.create({ data });
}
