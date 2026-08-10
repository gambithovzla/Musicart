"use client";

// Fase 9.7 — El gobierno de la cima del canon, desde el panel del curador.
//
// Dos operaciones y nada más: fijar un puntaje a mano (y con eso sacarlo del
// alcance de la fórmula) y meter en el índice un disco que Wikidata no trajo.
// La curaduría fina de cada disco vive en su propia ficha; esto es la vista de
// conjunto, para gobernar el club de los 100 de un vistazo.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SalonAlbum } from "@/lib/canon/consulta";
import {
  fijarPuntajeCanon,
  soltarPuntajeCanon,
  anadirAlCanon,
} from "../salon/admin-actions";

export function ClubDeLosCien({
  fijados,
  candidatos,
  total,
}: {
  fijados: SalonAlbum[];
  candidatos: SalonAlbum[];
  total: number;
}) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const [titulo, setTitulo] = useState("");
  const [artista, setArtista] = useState("");
  const [scoreNuevo, setScoreNuevo] = useState(100);

  function correr(
    accion: () => Promise<{ ok: boolean; error?: string }>,
    exito: string,
  ) {
    setMensaje(null);
    startTransition(async () => {
      const r = await accion();
      setMensaje(r.ok ? exito : (r.error ?? "No se pudo."));
      if (r.ok) router.refresh();
    });
  }

  if (total === 0) {
    return (
      <p className="mt-5 rounded-2xl bg-surface p-5 text-sm leading-relaxed text-dim">
        El índice del canon está vacío. Constrúyelo con{" "}
        <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">npm run canon</code>{" "}
        (o <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">--limite 150</code>{" "}
        para una prueba corta) con la <code>DATABASE_URL</code> de Railway.
      </p>
    );
  }

  return (
    <div className="mt-5 space-y-6">
      {/* Añadir a mano: la salida de emergencia contra el sesgo del índice. */}
      <div className="rounded-2xl border border-album/20 bg-album/5 p-4">
        <p className="text-sm font-medium text-album-light">
          Meter un disco en el canon
        </p>
        <p className="mt-1 text-xs leading-relaxed text-dim">
          Para lo que el índice no trajo. Wikipedia sobre-representa al mundo
          anglosajón, así que un clásico venezolano o de flamenco puede
          quedarse fuera aunque merezca estar. Entra con tu puntaje fijado.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Disco"
            className="flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-album/60"
          />
          <input
            value={artista}
            onChange={(e) => setArtista(e.target.value)}
            placeholder="Artista"
            className="flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-album/60"
          />
          <input
            type="number"
            min={55}
            max={100}
            value={scoreNuevo}
            onChange={(e) => setScoreNuevo(Number(e.target.value))}
            className="w-20 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm tabular-nums outline-none focus:border-album/60"
          />
        </div>
        <button
          type="button"
          disabled={pendiente || !titulo.trim() || !artista.trim()}
          onClick={() =>
            correr(async () => {
              const r = await anadirAlCanon(titulo, artista, scoreNuevo);
              if (r.ok) {
                setTitulo("");
                setArtista("");
              }
              return r;
            }, `"${titulo}" entra al canon con ${scoreNuevo}.`)
          }
          className="mt-3 rounded-full bg-album px-4 py-2 text-xs font-medium text-black disabled:opacity-50"
        >
          Añadir al canon
        </button>
      </div>

      {mensaje && <p className="text-xs text-album-light">{mensaje}</p>}

      <Bloque
        titulo={`Fijados a mano (${fijados.length})`}
        vacio="Todavía no has fijado ningún puntaje. Los de abajo los decide la fórmula."
        albums={fijados}
        accion={(a) => (
          <button
            type="button"
            disabled={pendiente}
            onClick={() =>
              correr(
                () => soltarPuntajeCanon(a.id),
                `"${a.title}" vuelve a manos de la fórmula.`,
              )
            }
            className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] disabled:opacity-50"
          >
            Soltar
          </button>
        )}
      />

      <Bloque
        titulo="Lo más alto según la fórmula"
        vacio="Nada por aquí."
        albums={candidatos}
        accion={(a) => (
          <button
            type="button"
            disabled={pendiente}
            onClick={() =>
              correr(
                () => fijarPuntajeCanon(a.id, 100),
                `"${a.title}" fijado en 100.`,
              )
            }
            className="rounded-full bg-album/90 px-3 py-1.5 text-[11px] font-medium text-black disabled:opacity-50"
          >
            Fijar en 100
          </button>
        )}
      />
    </div>
  );
}

function Bloque({
  titulo,
  vacio,
  albums,
  accion,
}: {
  titulo: string;
  vacio: string;
  albums: SalonAlbum[];
  accion: (a: SalonAlbum) => React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-dim">{titulo}</p>
      {albums.length === 0 ? (
        <p className="mt-2 text-sm text-dim">{vacio}</p>
      ) : (
        <ul className="mt-2.5 divide-y divide-white/5 rounded-2xl border border-white/10 bg-surface">
          {albums.map((a) => (
            <li key={a.id} className="flex items-center gap-3 p-3">
              <span className="w-9 shrink-0 text-center font-serif text-sm tabular-nums text-album-light">
                {a.score}
              </span>
              <Link
                href={`/salon/disco/${a.id}`}
                className="min-w-0 flex-1 underline-offset-4 hover:underline"
              >
                <span className="block truncate text-sm">{a.title}</span>
                <span className="block truncate text-xs text-dim">
                  {a.artist}
                  {a.year ? ` · ${a.year}` : ""}
                </span>
              </Link>
              {accion(a)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
