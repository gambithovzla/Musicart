import React from "react";
import {
  AbsoluteFill,
  Html5Audio,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import frauncesUrl from "../../lib/imprenta-og/Fraunces-SemiBold.ttf";
import archivoUrl from "../../lib/imprenta-og/Archivo-Regular.ttf";
import monoUrl from "../../lib/imprenta-og/IBMPlexMono-Medium.ttf";
import type { SocialRenderProps } from "../../lib/social/types";

const ink = "#efe9dc";
const dim = "#aaa293";
const gold = "#c9a85f";
const paper = "#12100d";

function audioSource(url: string) {
  return url.startsWith("/") ? staticFile(url.slice(1)) : url;
}

// Rótulos en español: antes salía el nombre interno de la escena ("hook",
// "context") en lo alto de cada plano.
const ROTULO: Record<string, string> = {
  hook: "El disco de hoy",
  context: "La historia",
  payoff: "El giro",
  cta: "Un disco al día",
};

export const SocialVertical: React.FC<SocialRenderProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const second = frame / fps;
  const scene = props.scenes.find((item) => second >= item.startSec && second < item.endSec) ?? props.scenes.at(-1)!;
  const sceneFrame = frame - Math.round(scene.startSec * fps);
  const enter = interpolate(sceneFrame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const leaveStart = Math.max(0, Math.round((scene.endSec - scene.startSec) * fps) - 10);
  const leave = interpolate(sceneFrame, [leaveStart, leaveStart + 10], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = Math.min(enter, leave);
  const translateY = interpolate(enter, [0, 1], [34, 0]);
  const progress = Math.min(1, frame / (props.durationSec * fps));
  const esPortada = scene.kind === "album" && Boolean(props.coverUrl);
  // La carátula de fondo se acerca despacio durante todo el video (como en las
  // historias de la app): da vida sin halos ni desenfoques.
  const acercamiento = interpolate(frame, [0, props.durationSec * fps], [1.04, 1.16]);

  return (
    <AbsoluteFill style={{ backgroundColor: paper, color: ink, fontFamily: "Archivo", overflow: "hidden" }}>
      <style>{`
        @font-face { font-family: Fraunces; src: url(${frauncesUrl}); font-weight: 600; }
        @font-face { font-family: Archivo; src: url(${archivoUrl}); font-weight: 400; }
        @font-face { font-family: Plex; src: url(${monoUrl}); font-weight: 500; }
      `}</style>
      {props.audioUrl ? <Html5Audio src={audioSource(props.audioUrl)} /> : null}

      {props.coverUrl ? (
        <Img
          src={props.coverUrl}
          // Si la carátula no carga, el video se imprime igual (solo tipografía).
          onError={() => {}}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(1) contrast(1.1)", opacity: 0.16, transform: `scale(${acercamiento})` }}
        />
      ) : null}
      <div style={{ position: "absolute", inset: 0, opacity: 0.2, backgroundImage: "repeating-linear-gradient(0deg, transparent 0, transparent 7px, rgba(255,255,255,.025) 8px)" }} />
      <header style={{ position: "absolute", top: 82, left: 86, right: 86, display: "flex", justifyContent: "space-between", fontFamily: "Plex", fontSize: 22, letterSpacing: 5, textTransform: "uppercase" }}>
        <span>Musicart</span>
        <span style={{ color: dim }}>№ {props.folio}</span>
      </header>
      <div style={{ position: "absolute", top: 142, left: 86, right: 86, height: 3, background: ink }} />
      <div style={{ position: "absolute", top: 152, left: 86, right: 86, height: 1, background: dim }} />

      <main style={{ position: "absolute", left: 86, right: 150, top: 300, bottom: 430, display: "flex", flexDirection: "column", justifyContent: "center", opacity, transform: `translateY(${translateY}px)` }}>
        {esPortada ? (
          <Img
            src={props.coverUrl!}
            onError={() => {}}
            style={{ width: 600, height: 600, objectFit: "cover", border: `3px solid ${ink}`, marginBottom: 56 }}
          />
        ) : null}
        <p style={{ margin: 0, color: gold, fontFamily: "Plex", fontSize: 24, letterSpacing: 6, textTransform: "uppercase" }}>
          {scene.kind === "album" ? `${props.artistName} · ${props.year}` : ROTULO[scene.kind] ?? ""}
        </p>
        <h1 style={{ margin: "42px 0 0", maxWidth: 900, fontFamily: "Fraunces", fontSize: scene.kind === "album" ? (esPortada ? 84 : 104) : 94, lineHeight: 1.03, fontWeight: 600, textWrap: "balance" }}>
          {scene.kind === "album" ? props.albumTitle : scene.headline}
        </h1>
        {scene.body ? (
          <p style={{ margin: "48px 0 0", maxWidth: 820, color: dim, fontSize: 38, lineHeight: 1.35 }}>
            {scene.body}
          </p>
        ) : null}
        <div style={{ marginTop: 64, width: 86, height: 5, background: gold }} />
      </main>

      <footer style={{ position: "absolute", left: 86, right: 86, bottom: 92 }}>
        <div style={{ height: 2, background: dim }} />
        <div style={{ height: 7, width: `${progress * 100}%`, background: gold, marginTop: -4 }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 34, color: dim, fontFamily: "Plex", fontSize: 20, letterSpacing: 3, textTransform: "uppercase" }}>
          <span>Un disco al día</span>
          <span>{Math.ceil(props.durationSec - second)} s</span>
        </div>
      </footer>
    </AbsoluteFill>
  );
};
