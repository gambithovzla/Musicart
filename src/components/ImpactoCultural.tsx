// Impacto cultural 1-100, clicleable: el número y su etiqueta siempre visibles;
// al tocar "¿por qué?" se abre una breve explicación basada SOLO en hechos
// verificados (premios, certificaciones, listas tipo Rolling Stone) — generada y
// verificada con el dossier. Usa <details> nativo: clicleable sin JS y sin estorbar.

export function etiquetaImpacto(v: number): string {
  if (v >= 90) return "hito histórico";
  if (v >= 75) return "clásico mayor";
  if (v >= 60) return "muy influyente";
  if (v >= 40) return "notable";
  if (v >= 20) return "de nicho";
  return "impacto modesto";
}

const ESCALA =
  "1-100: 90+ hito, 75+ clásico mayor, 60+ muy influyente, 40+ notable, menos de 40 de nicho.";

export function ImpactoCultural({
  value,
  note,
}: {
  value: number;
  note?: string | null;
}) {
  const v = Math.max(1, Math.min(100, Math.round(value)));
  return (
    <details className="group inline-block text-left align-middle">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1 tabular-nums [&::-webkit-details-marker]:hidden">
        <span className="text-dim">Impacto</span>
        <span className="font-semibold text-album-light">{v}</span>
        <span className="text-dim">/100 · {etiquetaImpacto(v)}</span>
        <span className="ml-0.5 text-album-light/70 underline decoration-dotted underline-offset-2 group-open:hidden">
          ¿por qué?
        </span>
      </summary>
      <div className="mt-2 max-w-xs rounded-xl border border-album/20 bg-album/5 px-4 py-3 text-xs leading-relaxed text-foreground/80">
        {note ? (
          <p>{note}</p>
        ) : (
          <p className="text-dim">
            Aún no tenemos el detalle de este disco. Pronto, con su historia
            verificada.
          </p>
        )}
        <p className="mt-2 text-dim">Impacto cultural · {ESCALA}</p>
      </div>
    </details>
  );
}
