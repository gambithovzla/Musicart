// "Verificado · fuentes": el superpoder anti-alucinación, visible. Muestra que
// cada dato del dossier se contrastó con fuentes públicas, y deja verlas con un
// clic. Usa <details> nativo (sin JS, no estorba). Datos del FactsPayload.

import type { FactsPayload } from "@/lib/types";

function esUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

function etiquetaUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("wikipedia")) return "Wikipedia";
    if (host.includes("musicbrainz")) return "MusicBrainz";
    if (host.includes("last.fm")) return "Last.fm";
    if (host.includes("apple")) return "Apple Music";
    return host;
  } catch {
    return "fuente";
  }
}

function etiquetaFuente(s: string): string {
  const l = s.toLowerCase();
  if (l.startsWith("wikipedia")) return "Wikipedia";
  if (l.startsWith("musicbrainz")) return "MusicBrainz";
  if (l.startsWith("lastfm")) return "Last.fm";
  if (l.includes("itunes") || l.includes("apple")) return "Apple Music";
  if (l.startsWith("odesli")) return "Odesli";
  return s;
}

export function FuentesVerificadas({ facts }: { facts: FactsPayload | null }) {
  if (!facts) return null;

  // Enlaces (URLs consultadas) y etiquetas de fuente (de cada hecho/pasaje).
  const urls = [...new Set((facts.sources ?? []).filter(esUrl))];
  const etiquetas = [
    ...new Set(
      [
        ...(facts.facts ?? []).map((f) => f.source),
        ...(facts.passages ?? []).map((p) => p.source),
      ]
        .filter((s) => s && !esUrl(s))
        .map(etiquetaFuente),
    ),
  ];

  if (urls.length === 0 && etiquetas.length === 0) {
    // Aun sin lista, comunicamos la garantía.
    return (
      <section className="mt-10 border-t border-white/10 pt-5 text-center">
        <p className="text-xs text-dim">
          <span className="text-album-light">✓ Verificado</span> · cada dato se
          contrastó con fuentes públicas. Nada inventado por la IA.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 border-t border-white/10 pt-5">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-center gap-2 text-xs text-dim [&::-webkit-details-marker]:hidden">
          <span className="text-album-light">✓ Verificado</span>
          <span>· {urls.length + etiquetas.length} fuentes</span>
          <span className="text-album-light/70 underline decoration-dotted underline-offset-2 group-open:hidden">
            ver
          </span>
        </summary>
        <div className="mx-auto mt-3 max-w-md rounded-2xl border border-album/20 bg-album/5 px-5 py-4 text-sm leading-relaxed text-foreground/80">
          <p className="text-xs text-dim">
            Cada dato de este dossier se contrastó con estas fuentes públicas; lo
            que no se pudo verificar, no se publicó.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {urls.map((u) => (
              <li key={u}>
                <a
                  href={u}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-album/30 bg-album/10 px-3 py-1 text-xs text-album-light underline-offset-2 hover:underline"
                >
                  {etiquetaUrl(u)} ↗
                </a>
              </li>
            ))}
            {etiquetas
              .filter((e) => !urls.some((u) => etiquetaUrl(u) === e))
              .map((e) => (
                <li
                  key={e}
                  className="rounded-full border border-white/15 px-3 py-1 text-xs text-dim"
                >
                  {e}
                </li>
              ))}
          </ul>
        </div>
      </details>
    </section>
  );
}
