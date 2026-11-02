// LAS ESCENAS de la historia deslizable — parte PURA (sin red ni base), para
// que la pueda importar la UI de cliente.
//
// Convierte un dossier en una secuencia de pantallas, como las historias de
// Instagram pero impresas: un gancho grande, la historia en trozos que se leen
// de un vistazo, los "¿sabías que…?", tres canciones (con su fragmento sonando)
// y el cierre para escucharlo entero. Sale del texto que YA existe: funciona con
// todas las historias publicadas, sin regenerar nada.

export type Escena =
  | { tipo: "portada" }
  | { tipo: "gancho"; texto: string }
  | { tipo: "texto"; rotulo: string; texto: string }
  | { tipo: "dato"; texto: string; n: number; de: number }
  | { tipo: "cancion"; position: number; title: string; note: string }
  | { tipo: "final" };

export type DossierParaHistoria = {
  artist: string;
  title: string;
  intro: string;
  artistStory: string;
  whyItMatters: string;
  wowFacts: string[];
  trackNotes: { position: number; title: string; note: string | null }[];
};

const MAX_TROZO = 360;

function frases(texto: string): string[] {
  return texto
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+(?=[«"“¿¡A-ZÁÉÍÓÚÑ])/)
    .map((f) => f.trim())
    .filter(Boolean);
}

/** Corta un texto en trozos de pantalla sin partir frases. */
export function trozos(texto: string, max = MAX_TROZO): string[] {
  const out: string[] = [];
  for (const parrafo of texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) {
    let actual = "";
    for (const f of frases(parrafo)) {
      if (actual && (actual + " " + f).length > max) {
        out.push(actual);
        actual = f;
      } else {
        actual = actual ? `${actual} ${f}` : f;
      }
    }
    if (actual) out.push(actual);
  }
  return out;
}

/** El gancho: la primera frase (o dos, si la primera es muy corta). */
function separarGancho(intro: string): { gancho: string; resto: string } {
  const fs = frases(intro.split(/\n\s*\n/)[0] ?? intro);
  let gancho = fs[0] ?? "";
  let usadas = 1;
  if (gancho.length < 70 && fs[1] && (gancho + " " + fs[1]).length <= 200) {
    gancho = `${gancho} ${fs[1]}`;
    usadas = 2;
  }
  // Lo que queda del primer párrafo + el resto de párrafos.
  const parrafos = intro.split(/\n\s*\n/);
  const restoPrimero = fs.slice(usadas).join(" ");
  const resto = [restoPrimero, ...parrafos.slice(1)].filter((p) => p.trim()).join("\n\n");
  return { gancho, resto };
}

export function armarEscenas(d: DossierParaHistoria): Escena[] {
  const escenas: Escena[] = [{ tipo: "portada" }];

  const { gancho, resto } = separarGancho(d.intro);
  if (gancho) escenas.push({ tipo: "gancho", texto: gancho });
  // Tres pantallas de historia como mucho: la entera está en el dossier, y una
  // historia de Instagram que no se acaba deja de ser una historia.
  for (const t of trozos(resto).slice(0, 3)) {
    escenas.push({ tipo: "texto", rotulo: "La historia", texto: t });
  }

  const artista = trozos(d.artistStory)[0];
  if (artista) escenas.push({ tipo: "texto", rotulo: `Quién era ${d.artist}`, texto: artista });

  const datos = d.wowFacts.filter(Boolean).slice(0, 3);
  datos.forEach((texto, i) => escenas.push({ tipo: "dato", texto, n: i + 1, de: datos.length }));

  // Tres canciones: la que da título al disco si existe, y las de notas más
  // jugosas (las largas suelen traer el dato; las cortas, la descripción).
  const conNota = d.trackNotes.filter((t) => t.note && t.note.trim().length > 25);
  const n = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
  const titular = conNota.find((t) => n(t.title) === n(d.title));
  const resto3 = conNota
    .filter((t) => t !== titular)
    .sort((a, b) => (b.note?.length ?? 0) - (a.note?.length ?? 0));
  const elegidas = [titular, ...resto3]
    .filter((t): t is (typeof conNota)[number] => Boolean(t))
    .slice(0, 3)
    .sort((a, b) => a.position - b.position);
  for (const t of elegidas) {
    escenas.push({ tipo: "cancion", position: t.position, title: t.title, note: t.note!.trim() });
  }

  const porque = trozos(d.whyItMatters)[0];
  if (porque) escenas.push({ tipo: "texto", rotulo: "Por qué importa", texto: porque });

  escenas.push({ tipo: "final" });
  return escenas;
}

/** Cuánto dura cada escena: lo que se tarda en leerla con calma (~17 letras/s). */
export function duracionMs(e: Escena): number {
  switch (e.tipo) {
    case "portada":
      return 4200;
    case "final":
      return 0; // la última no avanza sola
    case "cancion":
      return Math.min(16_000, Math.max(9_000, 3_000 + e.note.length * 60));
    default: {
      const largo = "texto" in e ? e.texto.length : 0;
      return Math.min(17_000, Math.max(5_000, 2_500 + largo * 58));
    }
  }
}
