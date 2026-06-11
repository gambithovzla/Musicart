// Tipos de dominio compartidos entre pipeline, seed y UI.

export type AlbumLinks = {
  spotify?: string;
  appleMusic?: string;
  youtubeMusic?: string;
};

export type Palette = {
  vibrant?: string;
  darkVibrant?: string;
  lightVibrant?: string;
  muted?: string;
  darkMuted?: string;
  lightMuted?: string;
};

// Un hecho verificado con su fuente (grounding del LLM).
export type Fact = {
  fact: string;
  source: string; // "musicbrainz" | "wikipedia:es" | "wikipedia:en" | "lastfm" | URL
};

// Paquete de hechos que recibe el LLM: la ÚNICA verdad sobre la que puede narrar.
export type FactsPayload = {
  album: {
    title: string;
    artist: string;
    year: number;
    releaseDate?: string;
    label?: string;
    durationMin?: number;
  };
  tracklist: { position: number; title: string }[];
  facts: Fact[];
  // Pasajes largos de contexto (extractos de Wikipedia, wiki de Last.fm).
  // El LLM puede narrar a partir de ellos; el verificador contrasta contra todo el payload.
  passages?: { source: string; text: string }[];
  tags?: string[];
  sources: string[]; // URLs consultadas
};

// Un salto de descubrimiento: de este disco puedes saltar a aquel otro.
// La connection SOLO puede afirmar relaciones respaldadas por el facts payload.
export type DiscoveryJump = {
  title: string; // álbum destino
  artist: string;
  connection: string; // la relación real que los une (rivalidad, colaboración, influencia…)
};

// Contenido narrativo de un dossier (output estructurado del LLM o escrito a mano).
export type DossierContent = {
  intro: string; // resumen de 2 minutos: la historia detrás del disco
  artistStory: string; // quién era el artista en ese momento
  whyItMatters: string; // por qué fue importante
  questions: string[]; // preguntas de reflexión post-escucha
  trackNotes: { position: number; title: string; note?: string }[];
  jumps?: DiscoveryJump[]; // 0-3 saltos de descubrimiento (la madriguera)
};

// MP3s de narración pre-renderizados por sección (TTS). Si falta, la UI usa Web Speech API.
export type DossierAudio = Partial<
  Record<"intro" | "artistStory" | "whyItMatters" | "tracks", string>
>;

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
