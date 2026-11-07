// La imprenta del video: empaqueta la composición de Remotion y la renderiza a
// MP4. Va aparte de render.ts a propósito: NO importa la base de datos, así la
// laptop de Panteón puede imprimir el video del día solo con la llave de la API
// (scripts/social-local.ts), sin tener la URL de Postgres.

import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { SocialRenderProps } from "./types";

export async function renderizarMp4(props: SocialRenderProps, output: string): Promise<void> {
  const serveUrl = await bundle({
    entryPoint: path.join(process.cwd(), "src", "video", "social", "index.tsx"),
    rootDir: process.cwd(),
    publicDir: path.join(process.cwd(), "public"),
    enableCaching: true,
  });
  const composition = await selectComposition({
    serveUrl,
    id: "SocialVertical",
    inputProps: props,
  });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: output,
    inputProps: props,
    pixelFormat: "yuv420p",
    crf: 18,
    x264Preset: "veryfast",
    concurrency: 1,
    overwrite: true,
  });
}
