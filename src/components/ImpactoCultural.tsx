// Impacto cultural en escala 1-100 (antes eran estrellas 1-5, que aplastaban
// todo en el mismo rango). Honesto: 100 = hito histórico; la mayoría está abajo.
// Junto al número va su etiqueta para que se entienda qué significa.

export function etiquetaImpacto(v: number): string {
  if (v >= 90) return "hito histórico";
  if (v >= 75) return "clásico mayor";
  if (v >= 60) return "muy influyente";
  if (v >= 40) return "notable";
  if (v >= 20) return "de nicho";
  return "impacto modesto";
}

export function ImpactoCultural({ value }: { value: number }) {
  const v = Math.max(1, Math.min(100, Math.round(value)));
  return (
    <span
      aria-label={`Impacto cultural ${v} de 100: ${etiquetaImpacto(v)}`}
      className="tabular-nums"
    >
      <span className="font-semibold text-album-light">{v}</span>
      <span className="text-dim">/100 · {etiquetaImpacto(v)}</span>
    </span>
  );
}
