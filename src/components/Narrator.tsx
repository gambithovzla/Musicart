"use client";

// Narración por voz de todo el dossier — para escuchar manejando o cocinando.
// v1: Web Speech API del navegador (gratis, sin claves).
// Si el dossier trae MP3s pre-renderizados (audioJson), los usa en su lugar.

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type NarratorSection = {
  id: string;
  label: string;
  text: string;
  audioUrl?: string;
};

type Status = "idle" | "playing" | "paused";

// Trocea el texto en frases (~250 caracteres) — evita que el navegador corte
// las locuciones largas y permite avanzar de sección con precisión.
function chunkText(text: string): string[] {
  const sentences = text.match(/[^.!?…]+[.!?…]+["»”]?\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if ((current + s).length > 250 && current) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function Narrator({ sections }: { sections: NarratorSection[] }) {
  const [status, setStatus] = useState<Status>("idle");
  const [currentSection, setCurrentSection] = useState(0);
  const [supported, setSupported] = useState(true);
  const queueRef = useRef<{ section: number; text: string }[]>([]);
  const indexRef = useRef(0);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stoppedRef = useRef(false);

  const hasAudioFiles = sections.every((s) => s.audioUrl);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      voiceRef.current =
        voices.find((v) => v.lang.startsWith("es") && v.localService) ??
        voices.find((v) => v.lang.startsWith("es")) ??
        null;
    };
    pickVoice();
    window.speechSynthesis.addEventListener("voiceschanged", pickVoice);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", pickVoice);
      window.speechSynthesis.cancel();
      audioRef.current?.pause();
    };
  }, []);

  const speakNext = useCallback(() => {
    if (stoppedRef.current) return;
    const item = queueRef.current[indexRef.current];
    if (!item) {
      setStatus("idle");
      setCurrentSection(0);
      return;
    }
    setCurrentSection(item.section);
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.lang = voiceRef.current?.lang ?? "es-ES";
    if (voiceRef.current) utterance.voice = voiceRef.current;
    utterance.rate = 0.97;
    utterance.onend = () => {
      indexRef.current += 1;
      speakNext();
    };
    utterance.onerror = () => {
      indexRef.current += 1;
      speakNext();
    };
    window.speechSynthesis.speak(utterance);
  }, []);

  const playWebSpeech = useCallback(
    (fromSection: number) => {
      window.speechSynthesis.cancel();
      stoppedRef.current = false;
      queueRef.current = sections.flatMap((s, si) =>
        si < fromSection
          ? []
          : chunkText(`${s.label}. ${s.text}`).map((text) => ({ section: si, text })),
      );
      indexRef.current = 0;
      setStatus("playing");
      speakNext();
    },
    [sections, speakNext],
  );

  const playAudioFiles = useCallback(
    (fromSection: number) => {
      audioRef.current?.pause();
      const audio = new Audio(sections[fromSection].audioUrl);
      audioRef.current = audio;
      setCurrentSection(fromSection);
      setStatus("playing");
      audio.onended = () => {
        if (fromSection + 1 < sections.length) playAudioFiles(fromSection + 1);
        else setStatus("idle");
      };
      void audio.play();
    },
    [sections],
  );

  const play = (fromSection = 0) =>
    hasAudioFiles ? playAudioFiles(fromSection) : playWebSpeech(fromSection);

  const pause = () => {
    if (hasAudioFiles) audioRef.current?.pause();
    else window.speechSynthesis.pause();
    setStatus("paused");
  };

  const resume = () => {
    if (hasAudioFiles) void audioRef.current?.play();
    else window.speechSynthesis.resume();
    setStatus("playing");
  };

  const stop = () => {
    stoppedRef.current = true;
    window.speechSynthesis.cancel();
    audioRef.current?.pause();
    audioRef.current = null;
    setStatus("idle");
    setCurrentSection(0);
  };

  if (!supported) return null;

  return (
    <>
      {/* Botón de inicio dentro del flujo */}
      {status === "idle" && (
        <button
          onClick={() => play(0)}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-album/40 bg-album/10 px-5 py-4 text-base font-medium text-album-light transition-transform active:scale-[0.98]"
        >
          <PlayIcon className="h-5 w-5" />
          Escuchar el dossier narrado
        </button>
      )}

      {/* Player persistente — controles grandes para manejar/cocinar */}
      <AnimatePresence>
        {status !== "idle" && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="fixed inset-x-0 bottom-[4.2rem] z-40 mx-auto max-w-lg px-4 pb-2"
          >
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#1a1611]/95 px-5 py-4 shadow-2xl backdrop-blur-md">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-widest text-album-light">
                  Narrando
                </p>
                <p className="truncate text-sm font-medium">
                  {sections[currentSection]?.label}
                </p>
              </div>
              <button
                onClick={status === "playing" ? pause : resume}
                aria-label={status === "playing" ? "Pausar" : "Reanudar"}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-album text-black transition-transform active:scale-95"
              >
                {status === "playing" ? (
                  <PauseIcon className="h-7 w-7" />
                ) : (
                  <PlayIcon className="h-7 w-7" />
                )}
              </button>
              <button
                onClick={stop}
                aria-label="Detener narración"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-foreground/80 active:scale-95"
              >
                <StopIcon className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}
function PauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
    </svg>
  );
}
function StopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}
