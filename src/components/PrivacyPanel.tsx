"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { deleteMyData, exportMyData } from "@/app/perfil/privacy-actions";

const STORAGE_KEY = "musicart:profile";

export function PrivacyPanel({ hasAccount }: { hasAccount: boolean }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function downloadExport(json: string, filename: string) {
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExport() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await exportMyData();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      downloadExport(result.json, result.filename);
      setMessage("Archivo descargado ✓");
    });
  }

  function handleDelete() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await deleteMyData();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignorar
      }
      setConfirmDelete(false);
      router.push("/");
      router.refresh();
    });
  }

  return (
    <section className="mt-12 border-t border-white/10 pt-8">
      <h2 className="font-serif text-lg">Tus datos</h2>
      <p className="mt-2 text-sm leading-relaxed text-dim">
        Descarga una copia de tu perfil, diario y recomendaciones. También puedes
        borrarlo todo{hasAccount ? " y eliminar tu cuenta" : " de este dispositivo"}.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={handleExport}
          className="w-full rounded-2xl border border-white/15 bg-surface px-6 py-3.5 text-sm font-medium transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {pending && !confirmDelete ? "Preparando archivo…" : "Descargar mis datos (.json)"}
        </button>

        {!confirmDelete ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
            className="w-full rounded-2xl border border-red-400/25 px-6 py-3.5 text-sm text-red-300/90 transition-colors hover:border-red-400/50 disabled:opacity-50"
          >
            Borrar mis datos
          </button>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-2xl border border-red-400/30 bg-red-950/30 p-4"
            >
              <p className="text-sm leading-relaxed text-red-200/90">
                {hasAccount
                  ? "Se borrarán tu perfil, diario, picks y tu cuenta de Musicart. No se puede deshacer."
                  : "Se borrarán tu perfil y diario de este dispositivo. No se puede deshacer."}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm text-dim"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleDelete}
                  className="flex-1 rounded-xl bg-red-500/90 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Borrando…" : "Sí, borrar todo"}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {message && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-center text-xs text-album-light"
          >
            {message}
          </motion.p>
        )}
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-center text-xs text-red-300/80"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}
