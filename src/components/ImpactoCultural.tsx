// Impacto cultural en escala 1-100 (antes eran estrellas 1-5, que aplastaban
// todo en el mismo rango). Honesto: 100 = hito histórico; la mayoría está abajo.

export function ImpactoCultural({ value }: { value: number }) {
  const v = Math.max(1, Math.min(100, Math.round(value)));
  return (
    <span aria-label={`Impacto cultural ${v} de 100`} className="tabular-nums">
      <span className="font-semibold text-album-light">{v}</span>
      <span className="text-dim">/100</span>
    </span>
  );
}
