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
      // No interrumpimos el reveal: aparece cuando ya viste tu disco. Y NUNCA
      // durante la bienvenida: ahí tapaba el botón "Empezar" de quien acababa
      // de llegar (se pide otra vez en la siguiente visita).
      window.setTimeout(() => {
        if (document.querySelector("[data-onboarding]")) return;
        setVisible(true);
      }, 12_000);
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
          className="recuadro fixed inset-x-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md p-4"
        >
          <p className="rotulo !text-acento">Edición de bolsillo</p>
          <p className="font-serif mt-1 text-lg font-medium leading-tight">
            Lleva Musicart en el bolsillo
          </p>
          <p className="mt-1 text-sm leading-relaxed text-tinta-suave">
            Instálala en tu pantalla de inicio: abre al instante, como una app.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void install()} className="sello">
              Instalar
            </button>
            <button type="button" onClick={dismiss} className="sello-hueco">
              Ahora no
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
