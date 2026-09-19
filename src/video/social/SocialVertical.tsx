import React from "react";
import {
  AbsoluteFill,
  Html5Audio,
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

  return (
    <AbsoluteFill style={{ backgroundColor: paper, color: ink, fontFamily: "Archivo", overflow: "hidden" }}>
      <style>{`
        @font-face { font-family: Fraunces; src: url(${frauncesUrl}); font-weight: 600; }
        @font-face { font-family: Archivo; src: url(${archivoUrl}); font-weight: 400; }
        @font-face { font-family: Plex; src: url(${monoUrl}); font-weight: 500; }
      `}</style>
      {props.audioUrl ? <Html5Audio src={audioSource(props.audioUrl)} /> : null}

      <div style={{ position: "absolute", inset: 0, opacity: 0.2, backgroundImage: "repeating-linear-gradient(0deg, transparent 0, transparent 7px, rgba(255,255,255,.025) 8px)" }} />
      <header style={{ position: "absolute", top: 82, left: 86, right: 86, display: "flex", justifyContent: "space-between", fontFamily: "Plex", fontSize: 22, letterSpacing: 5, textTransform: "uppercase" }}>
        <span>Musicart</span>
        <span style={{ color: dim }}>№ {props.folio}</span>
      </header>
      <div style={{ position: "absolute", top: 142, left: 86, right: 86, height: 3, background: ink }} />
      <div style={{ position: "absolute", top: 152, left: 86, right: 86, height: 1, background: dim }} />

      <main style={{ position: "absolute", left: 86, right: 86, top: 330, bottom: 330, display: "flex", flexDirection: "column", justifyContent: "center", opacity, transform: `translateY(${translateY}px)` }}>
        <p style={{ margin: 0, color: gold, fontFamily: "Plex", fontSize: 22, letterSpacing: 6, textTransform: "uppercase" }}>
          {scene.kind === "album" ? `${props.artistName} · ${props.year}` : scene.kind}
        </p>
        <h1 style={{ margin: "42px 0 0", maxWidth: 900, fontFamily: "Fraunces", fontSize: scene.kind === "album" ? 104 : 94, lineHeight: 1.03, fontWeight: 600, textWrap: "balance" }}>
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
