"use client";

// Invitación discreta a instalar la PWA: aparece tras un momento de uso,
// se puede descartar y no vuelve a molestar en 30 días.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DISMISS_KEY = "musicart:install-dismissed";
const DISMISS_DAYS = 30;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function wasDismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const elapsed = Date.now() - Number(raw);
    return elapsed < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    Boolean((window.navigator as { standalone?: boolean }).standalone)
  );
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      // No interrumpimos el reveal: aparece cuando ya viste tu disco.
      window.setTimeout(() => setVisible(true), 12_000);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // sin storage no insistimos igual
    }
  }

  async function install() {
    if (!deferred) return;
    setVisible(false);
    await deferred.prompt();
    setDeferred(null);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-2xl border border-album/30 bg-[#161310]/95 p-4 shadow-2xl backdrop-blur-md"
        >
          <p className="font-serif text-base font-medium">
            Lleva Musicart en el bolsillo
          </p>
          <p className="mt-1 text-sm leading-relaxed text-dim">
            Instálala en tu pantalla de inicio: abre al instante, como una app.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void install()}
              className="rounded-full bg-album px-5 py-2 text-sm font-semibold text-black"
            >
              Instalar
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full px-3 py-2 text-sm text-dim"
            >
              Ahora no
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
