"use client";

// Botón solo-admin para borrar un disco del catálogo (con confirmación de 2 pasos).
// Útil para limpiar un sencillo que se coló o un disco no deseado.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { borrarAlbum } from "@/app/revision/actions";

export function BorrarDiscoAdmin({
  albumId,
  title,
}: {
  albumId: string;
  title: string;
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function borrar() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await borrarAlbum(albumId);
        if (r.ok) {
          router.push("/explorar");
          router.refresh();
        } else {
          setError(r.message);
          setConfirmando(false);
        }
      } catch (e) {
        setError((e as Error).message);
        setConfirmando(false);
      }
    });
  }

  return (
    <div className="mt-10 border-t border-white/10 pt-6 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-dim">Admin</p>
      {!confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="mt-3 rounded-full border border-red-400/30 px-5 py-2.5 text-sm text-red-300/90 transition-colors hover:border-red-400/60"
        >
          🗑 Borrar este disco
        </button>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-3">
          <p className="text-sm text-dim">
            ¿Seguro? Se borra «{title}» y sus reseñas. No se puede deshacer.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={borrar}
              className="rounded-full bg-red-500/90 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Borrando…" : "Sí, borrar"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmando(false)}
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-dim disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </div>
  );
}
