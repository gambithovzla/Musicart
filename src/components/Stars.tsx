export function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="tracking-tight" aria-label={`${value} de ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < value ? "text-album" : "text-white/15"}>
          ★
        </span>
      ))}
    </span>
  );
}
