// El sello del puntaje del canon: el número con el que se reconoce un disco en
// el Salón. Cuanto más alto, más "dorado" — un 100 tiene que verse distinto a
// un 78 de un vistazo, sin leer el número.

const TAMANOS = {
  sm: "h-9 w-9 text-[13px]",
  md: "h-12 w-12 text-base",
  lg: "h-20 w-20 text-2xl",
} as const;

function estilo(score: number): string {
  if (score >= 100) {
    return "border-amber-300/70 bg-amber-300/15 text-amber-200 shadow-[0_0_20px_-4px_rgba(252,211,77,0.6)]";
  }
  if (score >= 95) return "border-amber-400/40 bg-amber-400/10 text-amber-200/90";
  if (score >= 90) return "border-white/25 bg-white/10 text-foreground";
  return "border-white/15 bg-white/5 text-dim";
}

export function SelloPuntaje({
  score,
  tam = "md",
}: {
  score: number;
  tam?: keyof typeof TAMANOS;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border font-serif font-semibold tabular-nums ${TAMANOS[tam]} ${estilo(score)}`}
      title={`${score} de 100 en el canon`}
      aria-label={`Puntaje del canon: ${score} de 100`}
    >
      {score}
    </span>
  );
}
