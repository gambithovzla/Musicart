import React from "react";
import { Composition, registerRoot } from "remotion";
import { SocialVertical } from "./SocialVertical";
import type { SocialRenderProps } from "../../lib/social/types";

const defaults: SocialRenderProps = {
  hook: "Hay discos que se oyen. Otros piden que entres en su mundo.",
  script: "Musicart presenta un disco para escuchar completo, con su historia y su contexto.",
  caption: "Un disco al día.",
  durationSec: 30,
  scenes: [
    { startSec: 0, endSec: 5, kind: "hook", headline: "Hay discos que se oyen.", body: "Otros piden que entres en su mundo.", sourceRefs: [] },
    { startSec: 5, endSec: 11, kind: "album", headline: "El disco de hoy", body: "Musicart", sourceRefs: [] },
    { startSec: 11, endSec: 21, kind: "context", headline: "Una historia detrás del sonido", body: "", sourceRefs: [] },
    { startSec: 21, endSec: 26, kind: "payoff", headline: "Escúchalo completo", body: "", sourceRefs: [] },
    { startSec: 26, endSec: 30, kind: "cta", headline: "Un disco al día.", body: "Musicart", sourceRefs: [] },
  ],
  albumTitle: "Musicart",
  artistName: "Un disco al día",
  year: 2026,
  folio: "000001",
  audioUrl: null,
};

const Root = () => (
  <Composition
    id="SocialVertical"
    component={SocialVertical}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={900}
    defaultProps={defaults}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.round(props.durationSec * 30),
    })}
  />
);

registerRoot(Root);
