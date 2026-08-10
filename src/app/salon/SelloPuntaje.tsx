// LA CIFRA — antes: una moneda dorada, redonda, con halo de neón.
//
// Aquel sello era el gesto más de plantilla de toda la app: círculo, degradado
// ámbar, sombra difuminada. Además mentía sobre lo que es este número: no es una
// medalla que le colgamos al disco, es un DATO calibrado contra todo el canon.
//
// Así que ahora se compone como un dato grabado: la cifra en display, apretada
// y con su "/100" pequeño al lado, dentro de un rectángulo entintado. La altura
// se lee por el PESO de la tinta, no por el brillo: un 100 va en negativo
// (papel sobre tinta), un 95 lleva marco macizo, y de ahí para abajo el marco se
// va afinando hasta ser una raya.

const TAMANOS = {
  sm: { caja: "px-1.5 py-0.5", num: "text-[15px]", cien: "text-[7px]" },
  md: { caja: "px-2 py-1", num: "text-2xl", cien: "text-[9px]" },
  lg: { caja: "px-3 py-2", num: "text-5xl", cien: "text-[11px]" },
} as const;

/** El peso de la tinta según la altura. Se lee sin leer el número. */
function entintado(score: number): string {
  if (score >= 100) return "bg-tinta text-papel border border-tinta";
  if (score >= 95) return "border-2 border-tinta text-tinta bg-papel/80";
  if (score >= 90) return "border border-tinta text-tinta bg-papel/80";
  return "border border-regla text-tinta-suave bg-papel/80";
}

export function SelloPuntaje({
  score,
  tam = "md",
}: {
  score: number;
  tam?: keyof typeof TAMANOS;
}) {
  const t = TAMANOS[tam];
  return (
    <span
      className={`inline-flex shrink-0 items-baseline gap-0.5 ${t.caja} ${entintado(score)}`}
      title={`${score} de 100 en el canon`}
      aria-label={`Puntaje del canon: ${score} de 100`}
    >
      <span className={`cifra font-semibold ${t.num}`}>{score}</span>
      <span className={`dato ${t.cien} opacity-55`}>/100</span>
    </span>
  );
}
