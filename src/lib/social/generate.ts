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

La voz debe sonar como un melómano que acaba de descubrir algo extraordinario: precisa, cálida y sin frases genéricas de influencer. El hook despierta curiosidad sin clickbait falso. No uses emojis. No incluyas audio comercial ni instrucciones de descargar música.

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

function fallbackPlan(d: LoadedDossier): SocialPlan {
  const title = d.album.title;
  const artist = d.album.artist.name;
  const narrative = words(`${d.intro} ${d.whyItMatters}`, 78);
  const durationSec = 30;
  return socialPlanSchema.parse({
    hook: `Hay discos que se oyen. «${title}» pide que entres en su mundo.`,
    script: `${title}, de ${artist}. ${narrative} Musicart propone escucharlo completo, en orden, y descubrir qué cambia cuando el álbum se entiende como una obra entera.`,
    caption: `Hoy en Musicart: «${title}», de ${artist}. Un disco para escuchar completo y con contexto. ¿Qué álbum te hizo sentir algo parecido? #Musicart #Discos #DescubrimientoMusical`,
    durationSec,
    scenes: [
      { startSec: 0, endSec: 4, kind: "hook", headline: `Hay discos que se oyen.`, body: "Otros piden que entres en su mundo.", sourceRefs: ["intro"] },
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

export async function generateSocialContent(dossierId: string) {
  const d = await loadDossier(dossierId);
  if (!d || d.status !== "published") throw new Error("El dossier debe estar publicado antes de convertirlo en video.");

  const facts = parseJson<FactsPayload | null>(d.album.factsJson, null);
  if (!facts) throw new Error("Este disco no tiene facts payload verificable.");
  const dossierText = [
    `INTRO: ${d.intro}`,
    `ARTISTA: ${d.artistStory}`,
    `IMPORTANCIA: ${d.whyItMatters}`,
    ...d.trackNotes.map((t, i) => `TRACK ${i}: ${t.title}. ${t.note ?? ""}`),
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

  return prisma.socialContent.create({
    data: {
      dossierId: d.id,
      status: verification.ok ? "draft" : "blocked",
      hook: plan.hook,
      script: plan.script,
      caption: plan.caption,
      scenesJson: JSON.stringify({ durationSec: plan.durationSec, scenes: plan.scenes }),
      factsSnapshotJson: JSON.stringify(facts),
      verificationJson: JSON.stringify(verification),
      rightsStatus: "clear",
    },
  });
}
