// El canon navegable: el índice completo con filtros de piso, década, país y
// género. Es la parte "biblioteca" del Salón — la portada es la ceremonia,
// esto es el catálogo.

import Link from "next/link";
import { listarCanon, filtrosDisponibles } from "@/lib/canon/consulta";
import { GaleriaCanon } from "../GaleriaCanon";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "El canon completo · Musicart",
};

type Params = {
  min?: string;
  max?: string;
  decada?: string;
  pais?: string;
  genero?: string;
  pagina?: string;
};

function aNumero(v: string | undefined): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default async function ListaCanonPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const filtros = {
    min: aNumero(sp.min),
    max: aNumero(sp.max),
    decada: aNumero(sp.decada),
    pais: sp.pais?.trim() || undefined,
    genero: sp.genero?.trim() || undefined,
    pagina: aNumero(sp.pagina) ?? 1,
  };

  const [listado, disponibles] = await Promise.all([
    listarCanon(filtros),
    filtrosDisponibles(),
  ]);

  // Conservar los filtros activos al cambiar de página o de faceta.
  function url(cambios: Partial<Record<keyof Params, string | undefined>>) {
    const qs = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      min: sp.min,
      max: sp.max,
      decada: sp.decada,
      pais: sp.pais,
      genero: sp.genero,
      ...cambios,
    };
    for (const [k, v] of Object.entries(base)) if (v) qs.set(k, v);
    const s = qs.toString();
    return `/salon/lista${s ? `?${s}` : ""}`;
  }

  const hayFiltros = Boolean(
    sp.min || sp.max || sp.decada || sp.pais || sp.genero,
  );

  return (
    <main className="px-6 pb-16 pt-14">
      <header className="text-center">
        <Link
          href="/salon"
          className="text-xs uppercase tracking-[0.3em] text-dim underline-offset-4 hover:underline"
        >
          ← El Salón
        </Link>
        <h1 className="font-serif mt-3 text-3xl font-semibold">El canon</h1>
        <p className="mt-2 text-sm text-dim">
          {listado.total} {listado.total === 1 ? "disco" : "discos"}
          {hayFiltros ? " con estos filtros" : " en el índice"}
        </p>
      </header>

      <nav className="mt-7 space-y-3">
        <Faceta titulo="Década">
          <Chip href={url({ decada: undefined })} activo={!sp.decada}>
            Todas
          </Chip>
          {disponibles.decadas.map((d) => (
            <Chip
              key={d}
              href={url({ decada: String(d), pagina: undefined })}
              activo={sp.decada === String(d)}
            >
              {d}s
            </Chip>
          ))}
        </Faceta>

        {disponibles.generos.length > 0 && (
          <Faceta titulo="Género">
            <Chip href={url({ genero: undefined })} activo={!sp.genero}>
              Todos
            </Chip>
            {disponibles.generos.map((g) => (
              <Chip
                key={g}
                href={url({ genero: g, pagina: undefined })}
                activo={sp.genero === g}
              >
                {g}
              </Chip>
            ))}
          </Faceta>
        )}

        {disponibles.paises.length > 0 && (
          <Faceta titulo="País">
            <Chip href={url({ pais: undefined })} activo={!sp.pais}>
              Todos
            </Chip>
            {disponibles.paises.slice(0, 16).map((p) => (
              <Chip
                key={p.code}
                href={url({ pais: p.code, pagina: undefined })}
                activo={sp.pais === p.code}
              >
                {p.nombre}
              </Chip>
            ))}
          </Faceta>
        )}
      </nav>

      <div className="mt-8">
        {listado.albums.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-surface p-10 text-center">
            <p className="font-serif text-lg">Nada por aquí</p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-dim">
              Ningún disco del canon cumple esos filtros a la vez. Prueba a
              soltar alguno.
            </p>
            <Link
              href="/salon/lista"
              className="mt-5 inline-block rounded-full border border-white/15 px-5 py-2.5 text-sm"
            >
              Quitar los filtros
            </Link>
          </div>
        ) : (
          <GaleriaCanon albums={listado.albums} />
        )}
      </div>

      {listado.paginas > 1 && (
        <div className="mt-10 flex items-center justify-between text-sm">
          {listado.pagina > 1 ? (
            <Link
              href={url({ pagina: String(listado.pagina - 1) })}
              className="rounded-full border border-white/15 px-4 py-2"
            >
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-dim">
            {listado.pagina} de {listado.paginas}
          </span>
          {listado.pagina < listado.paginas ? (
            <Link
              href={url({ pagina: String(listado.pagina + 1) })}
              className="rounded-full border border-white/15 px-4 py-2"
            >
              Siguiente →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </main>
  );
}

function Faceta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] uppercase tracking-[0.2em] text-dim">
        {titulo}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  href,
  activo,
  children,
}: {
  href: string;
  activo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
        activo
          ? "border-album/60 bg-album/10 text-album-light"
          : "border-white/15 text-foreground/75 hover:border-white/30"
      }`}
    >
      {children}
    </Link>
  );
}
