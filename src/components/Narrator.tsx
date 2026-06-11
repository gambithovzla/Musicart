"use client";

// Narración por voz del dossier — Web Speech o MP3s pre-renderizados (audioJson).
// Fase 4: modo conductor + Media Session API (controles en pantalla de bloqueo).

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type NarratorSection = {
  id: string;
  label: string;
  text: string;
  audioUrl?: string;
};

export type NarratorMeta = {
  albumTitle: string;
  artistName: string;
  coverUrl?: string | null;
};

type Status = "idle" | "playing" | "paused";

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

export function Narrator({
  sections,
  meta,
}: {
  sections: NarratorSection[];
  meta?: NarratorMeta;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [driverMode, setDriverMode] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);
  const [supported, setSupported] = useState(true);
  const queueRef = useRef<{ section: number; text: string }[]>([]);
  const indexRef = useRef(0);
  const sectionRef = useRef(0);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stoppedRef = useRef(false);
  const statusRef = useRef<Status>("idle");

  const hasAudioFiles = sections.every((s) => s.audioUrl);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const updateMediaSession = useCallback(
    (sectionIndex: number, playing: boolean) => {
      if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
      const section = sections[sectionIndex];
      if (!section || !meta) return;

      navigator.mediaSession.metadata = new MediaMetadata({
        title: section.label,
        artist: `${meta.albumTitle} — ${meta.artistName}`,
        album: "Musicart",
        artwork: meta.coverUrl
          ? [{ src: meta.coverUrl, sizes: "512x512", type: "image/jpeg" }]
          : [],
      });
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    },
    [sections, meta],
  );

  const bindMediaHandlers = useCallback(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => {
      if (statusRef.current === "paused") resumeRef.current();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      if (statusRef.current === "playing") pauseRef.current();
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => {
      skipSectionRef.current(1);
    });
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      skipSectionRef.current(-1);
    });
  }, []);

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
    bindMediaHandlers();
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", pickVoice);
      window.speechSynthesis.cancel();
      audioRef.current?.pause();
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "none";
        navigator.mediaSession.metadata = null;
      }
    };
  }, [bindMediaHandlers]);

  const speakNext = useCallback(() => {
    if (stoppedRef.current) return;
    const item = queueRef.current[indexRef.current];
    if (!item) {
      setStatus("idle");
      setCurrentSection(0);
      sectionRef.current = 0;
      updateMediaSession(0, false);
      return;
    }
    sectionRef.current = item.section;
    setCurrentSection(item.section);
    updateMediaSession(item.section, true);

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
  }, [updateMediaSession]);

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
      sectionRef.current = fromSection;
      setCurrentSection(fromSection);
      setStatus("playing");
      updateMediaSession(fromSection, true);
      speakNext();
    },
    [sections, speakNext, updateMediaSession],
  );

  const playAudioFiles = useCallback(
    (fromSection: number) => {
      audioRef.current?.pause();
      const audio = new Audio(sections[fromSection].audioUrl);
      audioRef.current = audio;
      sectionRef.current = fromSection;
      setCurrentSection(fromSection);
      setStatus("playing");
      updateMediaSession(fromSection, true);
      audio.onended = () => {
        if (fromSection + 1 < sections.length) playAudioFiles(fromSection + 1);
        else {
          setStatus("idle");
          updateMediaSession(0, false);
        }
      };
      void audio.play();
    },
    [sections, updateMediaSession],
  );

  const play = useCallback(
    (fromSection = 0) => {
      setDriverMode(true);
      return hasAudioFiles ? playAudioFiles(fromSection) : playWebSpeech(fromSection);
    },
    [hasAudioFiles, playAudioFiles, playWebSpeech],
  );

  const pause = useCallback(() => {
    if (hasAudioFiles) audioRef.current?.pause();
    else window.speechSynthesis.pause();
    setStatus("paused");
    updateMediaSession(sectionRef.current, false);
  }, [hasAudioFiles, updateMediaSession]);

  const resume = useCallback(() => {
    if (hasAudioFiles) void audioRef.current?.play();
    else window.speechSynthesis.resume();
    setStatus("playing");
    updateMediaSession(sectionRef.current, true);
  }, [hasAudioFiles, updateMediaSession]);

  const pauseRef = useRef(pause);
  const resumeRef = useRef(resume);
  pauseRef.current = pause;
  resumeRef.current = resume;

  const stop = useCallback(() => {
    stoppedRef.current = true;
    window.speechSynthesis.cancel();
    audioRef.current?.pause();
    audioRef.current = null;
    setStatus("idle");
    setCurrentSection(0);
    sectionRef.current = 0;
    setDriverMode(false);
    updateMediaSession(0, false);
  }, [updateMediaSession]);

  const skipSection = useCallback(
    (delta: number) => {
      const next = Math.min(
        sections.length - 1,
        Math.max(0, sectionRef.current + delta),
      );
      if (next === sectionRef.current && delta > 0) {
        stop();
        return;
      }
      stoppedRef.current = true;
      window.speechSynthesis.cancel();
      audioRef.current?.pause();
      stoppedRef.current = false;
      if (hasAudioFiles) playAudioFiles(next);
      else playWebSpeech(next);
    },
    [sections.length, hasAudioFiles, playAudioFiles, playWebSpeech, stop],
  );

  const skipSectionRef = useRef(skipSection);
  skipSectionRef.current = skipSection;

  if (!supported) return null;

  return (
    <>
      {status === "idle" && (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => play(0)}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-album/40 bg-album/10 px-5 py-4 text-base font-medium text-album-light transition-transform active:scale-[0.98]"
          >
            <PlayIcon className="h-5 w-5" />
            Modo conductor — escuchar el dossier
          </button>
          <p className="text-center text-xs text-dim">
            Narración continua con controles en pantalla de bloqueo
          </p>
        </div>
      )}

      <AnimatePresence>
        {status !== "idle" && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className={`fixed inset-x-0 z-40 mx-auto max-w-lg px-4 ${
              driverMode ? "bottom-[4.2rem]" : "bottom-[4.2rem]"
            } pb-2`}
          >
            <div
              className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1a1611]/95 shadow-2xl backdrop-blur-md ${
                driverMode ? "px-5 py-5" : "px-5 py-4"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-widest text-album-light">
                  {driverMode ? "Modo conductor" : "Narrando"}
                </p>
                <p className={`truncate font-medium ${driverMode ? "text-base" : "text-sm"}`}>
                  {sections[currentSection]?.label}
                </p>
                {meta && driverMode && (
                  <p className="truncate text-xs text-dim">
                    {meta.albumTitle} · {meta.artistName}
                  </p>
                )}
              </div>
              {driverMode && sections.length > 1 && (
                <button
                  onClick={() => skipSection(-1)}
                  disabled={currentSection === 0}
                  aria-label="Sección anterior"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 text-foreground/80 disabled:opacity-30"
                >
                  <SkipBackIcon className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={status === "playing" ? pause : resume}
                aria-label={status === "playing" ? "Pausar" : "Reanudar"}
                className={`flex shrink-0 items-center justify-center rounded-full bg-album text-black transition-transform active:scale-95 ${
                  driverMode ? "h-16 w-16" : "h-14 w-14"
                }`}
              >
                {status === "playing" ? (
                  <PauseIcon className={driverMode ? "h-8 w-8" : "h-7 w-7"} />
                ) : (
                  <PlayIcon className={driverMode ? "h-8 w-8" : "h-7 w-7"} />
                )}
              </button>
              {driverMode && sections.length > 1 && (
                <button
                  onClick={() => skipSection(1)}
                  disabled={currentSection >= sections.length - 1}
                  aria-label="Siguiente sección"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 text-foreground/80 disabled:opacity-30"
                >
                  <SkipForwardIcon className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={stop}
                aria-label="Detener narración"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 text-foreground/80 active:scale-95"
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
function SkipBackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11 7v10l-7-5 7-5zm2 0v10l7-5-7-5z" />
    </svg>
  );
}
function SkipForwardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4 7v10l7-5-7-5zm9 0v10l7-5-7-5z" />
    </svg>
  );
}
