import type { ProductMetrics } from "@/lib/analytics";
import { freemiumLimit } from "@/lib/freemium";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface px-4 py-3">
      <p className="text-xs text-dim">{label}</p>
      <p className="font-serif mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-dim">{hint}</p>}
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate text-foreground/90">{label}</span>
        <span className="shrink-0 tabular-nums text-dim">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-album/80"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function AnalyticsPanel({ metrics }: { metrics: ProductMetrics }) {
  const limit = freemiumLimit();
  const moodMax = metrics.ritual.moods[0]?.count ?? 1;
  const albumMax = metrics.topAlbums30d[0]?.views ?? 1;

  return (
    <section className="mt-10">
      <h2 className="font-serif text-xl">Métricas</h2>
      <p className="mt-1 text-sm text-dim">
        Últimos 7 / 30 días · mes {metrics.period.month}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Cuentas" value={metrics.users.total} hint={`+${metrics.users.newLast7d} esta semana`} />
        <Stat label="Pro activos" value={metrics.users.proActive} />
        <Stat
          label="Oyentes únicos (7d)"
          value={metrics.engagement.uniqueListeners7d}
        />
        <Stat
          label="Lecturas dossier (7d)"
          value={metrics.engagement.dossierViews7d}
          hint={`${metrics.engagement.dossierViews30d} en 30d`}
        />
        <Stat
          label="Reseñas"
          value={metrics.engagement.reviewsTotal}
          hint={
            metrics.engagement.avgRating != null
              ? `★ ${metrics.engagement.avgRating.toFixed(1)} media · +${metrics.engagement.reviews7d} semana`
              : `+${metrics.engagement.reviews7d} esta semana`
          }
        />
        <Stat
          label="Rituales / picks (7d)"
          value={metrics.ritual.dailyPicks7d}
        />
        <Stat label="Perfiles" value={metrics.engagement.profilesTotal} />
        <Stat
          label="En tope gratis"
          value={metrics.engagement.atFreemiumLimit}
          hint={`${limit} dossiers/mes`}
        />
        <Stat
          label="Catálogo"
          value={metrics.catalog.published}
          hint={`${metrics.catalog.drafts} drafts · cola ${metrics.catalog.queuePending} pend.`}
        />
      </div>

      {metrics.topAlbums30d.length > 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-surface p-5">
          <h3 className="text-sm font-medium">Top dossiers (30d)</h3>
          <div className="mt-4 flex flex-col gap-3">
            {metrics.topAlbums30d.map((a) => (
              <BarRow
                key={`${a.artist}-${a.title}`}
                label={`${a.title} · ${a.artist}`}
                value={a.views}
                max={albumMax}
              />
            ))}
          </div>
        </div>
      )}

      {metrics.ritual.moods.length > 0 && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-surface p-5">
          <h3 className="text-sm font-medium">Ánimos del check-in (30d)</h3>
          <div className="mt-4 flex flex-col gap-3">
            {metrics.ritual.moods.map((m) => (
              <BarRow key={m.mood} label={m.mood} value={m.count} max={moodMax} />
            ))}
          </div>
        </div>
      )}

      {metrics.catalog.queueFailed > 0 && (
        <p className="mt-4 text-xs text-red-300/90">
          {metrics.catalog.queueFailed} item(s) en cola con error — revisa abajo.
        </p>
      )}
    </section>
  );
}
