// Bloques de carga con shimmer: la app responde al instante mientras llega la DB.

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`skeleton-shimmer rounded-xl bg-white/[0.06] ${className}`}
      aria-hidden
    />
  );
}

/** Cabecera estándar de página (kicker + título). */
export function SkeletonHeader() {
  return (
    <header>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-56" />
    </header>
  );
}

/** Tarjeta horizontal (portada chica + dos líneas). */
export function SkeletonCard() {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-surface p-4">
      <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-2 h-3 w-1/2" />
      </div>
    </div>
  );
}
