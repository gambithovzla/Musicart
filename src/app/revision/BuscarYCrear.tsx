"use client";

// Buscador visual del curador: escribe un disco o artista, aparecen resultados
// con su portada (Deezer), tocas uno y la IA fabrica el dossier completo
// (historia, anécdotas, notas canción-por-canción, verificado). Al terminar,
// puedes puntuarlo y ponerlo en la vitrina sin salir de aquí.

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { AlbumSuggestion } from "@/lib/sources/deezer";
import { generarAlbumAhora, type GenerarAlbumResult } from "./actions";
import { EstrellasCurador, VitrinaToggle } from "./CuradorControls";

type Creado = GenerarAlbumResult & { title: string; artist: string; cover: string | null };

export function BuscarYCrear() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AlbumSuggestion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [creando, setCreando] = useState<string | null>(null); // key del disco en creación
  const [pending, startTransition] = useTransition();
  const [creado, setCreado] = useState<Creado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (debounce.current) clearTimeout(debounce.current);
    if (term.length < 2) {
      setResults([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    debounce.current = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch(`/api/albums?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { results: AlbumSuggestion[] };
        setResults(data.results ?? []);
      } catch {
        // abortado o error de red: dejamos los resultados como están
      } finally {
        setBuscando(false);
      }
    }, 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q]);

  function crear(sug: AlbumSuggestion) {
    if (pending) return;
    const key = `${sug.title}::${sug.artist}`;
    setCreando(key);
    setCreado(null);
    setError(null);
    startTransition(async () => {
      try {
        const r = await generarAlbumAhora({
          title: sug.title,
          artist: sug.artist,
          publish: true,
        });
        setCreado({ ...r, title: sug.title, artist: sug.artist, cover: sug.cover });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setCreando(null);
      }
    });
  }

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Busca un disco o artista (p. ej. Rumours, Radiohead…)"
          disabled={pending}
          className="w-full rounded-2xl border border-white/10 bg-surface px-5 py-4 text-base outline-none placeholder:text-dim focus:border-album/50 disabled:opacity-50"
        />
        {buscando && (
          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs text-dim">
            buscando…
          </span>
        )}
      </div>

      {results.length > 0 && !creado && (
        <ul className="flex flex-col gap-2">
          {results.map((sug) => {
            const key = `${sug.title}::${sug.artist}`;
            const enCurso = creando === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => crear(sug)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-surface p-3 text-left transition-colors hover:border-album/40 disabled:opacity-50"
                >
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/5">
                    {sug.cover && (
                      <Image
                        src={sug.cover}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                        unoptimized
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{sug.title}</span>
                    <span className="block truncate text-sm text-dim">{sug.artist}</span>
                  </span>
                  <span className="shrink-0 text-xs text-album-light">
                    {enCurso ? "creando… (1-3 min)" : "crear →"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {creando && (
        <p className="rounded-xl border border-album/20 bg-album/5 px-4 py-3 text-sm text-album-light">
          Fabricando el dossier — busca datos reales, escribe la historia y la
          verifica. Tarda 1-3 min; no cierres la pestaña.
        </p>
      )}

      {creado && <ResultadoCreado creado={creado} onReset={() => { setCreado(null); setQ(""); setResults([]); }} />}

      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function ResultadoCreado({ creado, onReset }: { creado: Creado; onReset: () => void }) {
  const publicado = creado.estado === "published";
  return (
    <div
      className={`rounded-2xl border p-4 ${
        publicado
          ? "border-album/30 bg-album/10"
          : "border-white/15 bg-surface"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white/5">
          {creado.cover && (
            <Image src={creado.cover} alt="" fill sizes="64px" className="object-cover" unoptimized />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{creado.title}</p>
          <p className="truncate text-sm text-dim">{creado.artist}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-foreground/90">{creado.message}</p>

      {creado.albumId && publicado && (
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <p className="mb-1.5 text-xs uppercase tracking-wide text-dim">Puntúalo</p>
            <EstrellasCurador albumId={creado.albumId} rating={null} />
          </div>
          <VitrinaToggle albumId={creado.albumId} inicial={false} />
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 text-sm">
        {creado.albumId && (
          <Link
            href={`/album/${creado.albumId}`}
            className="underline underline-offset-4"
          >
            Ver el disco →
          </Link>
        )}
        <button type="button" onClick={onReset} className="text-dim underline underline-offset-4">
          Buscar otro
        </button>
      </div>
    </div>
  );
}
