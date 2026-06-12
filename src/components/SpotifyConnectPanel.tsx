"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { signInWithSpotify } from "@/app/entrar/actions";
import {
  refreshSpotifyTaste,
  unlinkSpotify,
  type SpotifyPanelState,
} from "@/app/perfil/spotify-actions";

type Props = SpotifyPanelState & { hasAccount: boolean };

export function SpotifyConnectPanel({ configured, linked, syncedAt, artistPreview, hasAccount }: Props) {
  const [state, setState] = useState({ linked, syncedAt, artistPreview });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [unlinking, startUnlink] = useTransition();
  const [connecting, startConnect] = useTransition();

  if (!configured) return null;

  function handleRefresh() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await refreshSpotifyTaste();
      if (!result.ok) {
        setError(result.error ?? "No pudimos sincronizar.");
        return;
      }
      setState((s) => ({ ...s, syncedAt: new Date().toISOString() }));
      setSuccess("Gustos actualizados desde Spotify.");
    });
  }

  function handleUnlink() {
    setError(null);
    setSuccess(null);
    startUnlink(async () => {
      await unlinkSpotify();
      setState({ linked: false, syncedAt: null, artistPreview: null });
      setSuccess("Spotify desconectado.");
    });
  }

  function handleConnect() {
    startConnect(async () => {
      const fd = new FormData();
      fd.set("next", "/perfil");
      await signInWithSpotify(fd);
    });
  }

  const syncedLabel =
    state.syncedAt &&
    new Date(state.syncedAt).toLocaleDateString("es", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-surface/60 p-5">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1DB954]/15 text-lg"
          aria-hidden
        >
          ♫
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-lg">Spotify</h2>
          <p className="mt-1 text-xs leading-relaxed text-dim">
            Conecta tu cuenta para que el curador conozca tus artistas y géneros
            reales. Solo leemos gustos; la escucha sigue en Spotify.
          </p>
        </div>
      </div>

      {state.linked && state.artistPreview && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-xl border border-[#1DB954]/25 bg-[#1DB954]/8 px-4 py-3"
        >
          <p className="text-sm font-medium text-[#1DB954]">Conectado</p>
          <p className="mt-1 text-sm text-foreground/90">{state.artistPreview}</p>
          {syncedLabel && (
            <p className="mt-1 text-xs text-dim">Sincronizado {syncedLabel}</p>
          )}
        </motion.div>
      )}

      {!hasAccount && (
        <p className="mt-4 text-xs text-dim">
          Primero{" "}
          <a href="/entrar" className="text-album-light underline">
            entra con tu cuenta
          </a>{" "}
          (o con Spotify directamente) para vincular gustos.
        </p>
      )}

      {hasAccount && (
        <div className="mt-4 flex flex-wrap gap-2">
          {!state.linked ? (
            <button
              type="button"
              disabled={connecting}
              onClick={handleConnect}
              className="rounded-full border border-[#1DB954]/40 bg-[#1DB954]/12 px-4 py-2.5 text-sm font-medium text-[#1DB954] transition-colors hover:bg-[#1DB954]/20 disabled:opacity-50"
            >
              {connecting ? "Abriendo Spotify…" : "Conectar Spotify"}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={handleRefresh}
                className="rounded-full border border-[#1DB954]/40 bg-[#1DB954]/12 px-4 py-2.5 text-sm font-medium text-[#1DB954] transition-colors hover:bg-[#1DB954]/20 disabled:opacity-50"
              >
                {pending ? "Sincronizando…" : "Actualizar gustos"}
              </button>
              <button
                type="button"
                disabled={unlinking}
                onClick={handleUnlink}
                className="rounded-full border border-white/15 px-4 py-2.5 text-sm text-dim transition-colors hover:border-white/30 hover:text-foreground disabled:opacity-50"
              >
                {unlinking ? "Desconectando…" : "Desconectar"}
              </button>
            </>
          )}
        </div>
      )}

      <AnimatePresence>
        {(error || success) && (
          <motion.p
            key={error ?? success ?? ""}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-3 text-xs ${error ? "text-red-300/90" : "text-album-light"}`}
          >
            {error ?? success}
          </motion.p>
        )}
      </AnimatePresence>

      <p className="mt-4 text-[11px] leading-relaxed text-dim/80">
        Modo desarrollo de Spotify: hasta 25 usuarios en allowlist. El dueño de la
        app debe añadirte en el dashboard de Spotify si ves error 403.
      </p>
    </section>
  );
}
