// La barrera de ESTILO de las historias: caza las frases de molde.
//
// El verificador (verify.ts) caza INVENTOS, pero no MULETILLAS: una historia
// puede ser 100% verdadera y aun así leerse como un folleto. El dueño lo dijo
// mirando el dossier de «Paranoid»: "lo veo muy genérico". Tenía razón:
//
//   "Imagina un estudio de grabación en 1970, donde el aire está cargado de
//    electricidad… se encuentra en un punto crucial de su carrera… sumergirse
//    en la esencia de una época y un género que sigue resonando hoy en día."
//
// Ninguna de esas frases dice algo que sea cierto SOLO de ese disco. Se pueden
// pegar en el dossier de cualquier otro cambiando el nombre. Esta lista es el
// repertorio que más se repetía; detectarlas es código (determinista, gratis y
// sin IA), y si aparecen, el redactor reescribe SOLO esas frases.
//
// Esto es lo mismo que reason-guard.ts hace con la razón del día, aplicado a la
// historia. Si una frase nueva se vuelve muletilla, se añade aquí y solo aquí.

export type Muletilla = { re: RegExp; porque: string };

export const MULETILLAS: Muletilla[] = [
  // Aperturas de molde
  { re: /^\s*imagina\b/im, porque: "abre con «Imagina…»" },
  { re: /\bcorr[ií]a el a[ñn]o\b/i, porque: "«corría el año»" },
  { re: /^\s*en (el a[ñn]o )?(19|20)\d{2},/im, porque: "abre con «En 19XX,»" },
  { re: /^\s*¿(alguna vez|qu[eé] pasa|te has)\b/im, porque: "abre con pregunta retórica" },
  // Relleno atmosférico sin dato
  { re: /cargad[oa] de (electricidad|tensi[oó]n|energ[ií]a|emoci[oó]n)/i, porque: "«cargado de electricidad»" },
  { re: /\bel aire (estaba|est[aá]|se sent[ií]a)\b/i, porque: "«el aire estaba…»" },
  { re: /\bpunto (crucial|de inflexi[oó]n|clave) (de|en) su carrera/i, porque: "«punto crucial de su carrera»" },
  { re: /\bsumerg(irse|ete|irte|e) en\b/i, porque: "«sumergirse en»" },
  { re: /\bla esencia de\b/i, porque: "«la esencia de»" },
  { re: /\bviaje (sonoro|musical|emocional)\b/i, porque: "«viaje sonoro»" },
  { re: /\bpaisaje(s)? sonoro(s)?\b/i, porque: "«paisaje sonoro»" },
  { re: /\btapiz\b/i, porque: "«tapiz»" },
  { re: /\bcrisol\b/i, porque: "«crisol»" },
  { re: /\bmontaña rusa (de )?emocio/i, porque: "«montaña rusa emocional»" },
  // Cierres de moraleja
  { re: /\bsigue(n)? resonando\b/i, porque: "«sigue resonando»" },
  { re: /\bresuena(n)? (hasta )?(hoy|todav[ií]a|a[uú]n)\b/i, porque: "«resuena hoy»" },
  { re: /\b(dej[oó]|dejando) (una )?huella (imborrable|indeleble|profunda)/i, porque: "«huella imborrable»" },
  { re: /\bcambi[oó] (para siempre )?(la historia de )?la m[uú]sica\b/i, porque: "«cambió la música»" },
  { re: /\bm[aá]s all[aá] de (su|las) (tiempo|[eé]poca|fronteras)/i, porque: "«más allá de su tiempo»" },
  { re: /\bprueba del tiempo\b/i, porque: "«la prueba del tiempo»" },
  { re: /\ben definitiva\b/i, porque: "«en definitiva»" },
  { re: /\bsin (lugar a )?duda(s)?,/i, porque: "«sin duda,»" },
  { re: /\bno es (solo|s[oó]lo|simplemente) un (disco|[aá]lbum)\b/i, porque: "«no es solo un disco»" },
  { re: /\bes mucho m[aá]s que\b/i, porque: "«es mucho más que»" },
  { re: /\bun testamento\b/i, porque: "«un testamento de»" },
  // Adjetivos de catálogo
  { re: /\batemporal(es)?\b/i, porque: "«atemporal»" },
  { re: /\bobra maestra\b/i, porque: "«obra maestra»" },
  { re: /\bic[oó]nic[oa]s?\b/i, porque: "«icónico»" },
  { re: /\blegendari[oa]s?\b/i, porque: "«legendario»" },
  { re: /\bemblem[aá]tic[oa]s?\b/i, porque: "«emblemático»" },
  { re: /\bimprescindible\b/i, porque: "«imprescindible»" },
  { re: /\bjoya (oculta|escondida)\b/i, porque: "«joya oculta»" },
  { re: /\bde principio a fin\b/i, porque: "«de principio a fin»" },
];

/** Los campos de prosa que se revisan (el resto son listas o datos). */
export type CampoProsa = "intro" | "artistStory" | "whyItMatters" | "impactNote";

export type Hallazgo = { campo: string; frase: string; porque: string };

/** Corta en frases para poder señalar la frase exacta, no el párrafo. */
function frases(texto: string): string[] {
  return texto
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((f) => f.trim())
    .filter(Boolean);
}

/**
 * Busca muletillas en la prosa. Devuelve cada frase culpable con su campo,
 * lista para pedir una reescritura quirúrgica (solo esas frases).
 */
export function detectarMuletillas(textos: Record<string, string | undefined | null>): Hallazgo[] {
  const out: Hallazgo[] = [];
  for (const [campo, texto] of Object.entries(textos)) {
    if (!texto) continue;
    for (const frase of frases(texto)) {
      for (const m of MULETILLAS) {
        if (m.re.test(frase)) {
          out.push({ campo, frase, porque: m.porque });
          break; // una frase basta con señalarla una vez
        }
      }
    }
  }
  return out;
}

/** La lista negra en texto, para dársela al redactor ANTES de escribir. */
export function listaNegraParaPrompt(): string {
  const unicas = [...new Set(MULETILLAS.map((m) => m.porque))];
  return unicas.join(" · ");
}
